import sys
import os

# --- Force Python to use the local development version of mcp-ui-bridge-python ---
# Construct the absolute path to your local mcp-ui-bridge-python directory
local_lib_path = os.path.abspath(os.path.join(
    os.path.dirname(__file__),  # Current file's directory (src)
    '..',                       # Up to mcp-external-server-python
    '..',                       # Up to "React to terminal conversor"
    'mcp-ui-bridge-python'      # Down to the library
))

# Check if this path exists (sanity check)
if os.path.isdir(local_lib_path):
    # Remove any existing paths that might point to a site-packages version of the library
    # This is important if a non-editable version was somehow previously installed or cached
    sys.path = [p for p in sys.path if 'mcp_ui_bridge_python' not in p.replace('\\', '/').lower()]
    
    # Add our local library path to the beginning of sys.path
    if local_lib_path not in sys.path:
        sys.path.insert(0, local_lib_path)
    print(f"--- ADDED TO SYS.PATH (for mcp-ui-bridge-python): {local_lib_path} ---")
else:
    print(f"--- WARNING: Local library path does not exist: {local_lib_path} ---")
# --- End of local library path forcing ---


print("--- DIAGNOSTIC: Top of mcp-external-server-python/src/main.py ---")
# Attempt to import a known module from the library to inspect its path
try:
    import mcp_ui_bridge_python.mcp_server
    print(f"--- DIAGNOSTIC: Imported mcp_ui_bridge_python.mcp_server ---")
    print(f"--- DIAGNOSTIC: Path to mcp_server.py: {mcp_ui_bridge_python.mcp_server.__file__}")
    print(f"--- DIAGNOSTIC: Path to mcp_ui_bridge_python package: {os.path.dirname(mcp_ui_bridge_python.__file__)}")
except ImportError as e:
    print(f"--- DIAGNOSTIC: FAILED to import mcp_ui_bridge_python.mcp_server. Error: {e} ---")
except AttributeError:
    print(f"--- DIAGNOSTIC: Imported mcp_ui_bridge_python but mcp_server has no __file__ (might be a namespace package issue or incomplete) ---")
    # This might happen if only the top-level __init__.py of the package is found
    # and mcp_server isn't correctly part of it or has an issue.
    # We can still try to print the package path.
    try:
        import mcp_ui_bridge_python
        print(f"--- DIAGNOSTIC: Path to mcp_ui_bridge_python package (fallback): {os.path.dirname(mcp_ui_bridge_python.__file__)}")
    except Exception as e_fallback:
        print(f"--- DIAGNOSTIC: Could not determine path for mcp_ui_bridge_python (fallback failed): {e_fallback} ---")


print(f"--- DIAGNOSTIC: Python executable: {sys.executable} ---")
print(f"--- DIAGNOSTIC: sys.path (after modification) ---")
for p in sys.path:
    print(f"    {p}")
print("--- DIAGNOSTIC: End of diagnostic block ---")

import asyncio
import logging
from typing import Any, Callable, Coroutine, Dict, Optional, Union

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from mcp_ui_bridge_python import (
    ActionResult,
    ClientAuthContext,
    CustomActionHandler,
    CustomActionHandlerParams,
    CustomAttributeReader,
    McpServerOptions,
    run_mcp_server,
    # Assuming InteractiveElementInfo is available for type hinting if needed
    # from mcp_ui_bridge_python.models import InteractiveElementInfo
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Global variable to simulate auth success/failure, similar to MANUALLY_ALLOW_CONNECTION
MANUALLY_ALLOW_CONNECTION = os.getenv("MANUALLY_ALLOW_CONNECTION", "true").lower() == "true"


# --- Custom Attribute Readers ---
def process_item_priority(value: Optional[str]) -> Union[int, str, None]:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return value  # Return original string if not a valid number

sample_custom_readers: list[CustomAttributeReader] = [
    CustomAttributeReader(
        attribute_name="data-mcp-custom-note",
        output_key="customNote",
        # No process_value, so it will store the raw string value
    ),
    CustomAttributeReader(
        attribute_name="data-mcp-item-priority",
        output_key="itemPriority",
        process_value=process_item_priority,
    ),
]


# --- Custom Action Handlers ---
async def get_custom_note_handler(params: CustomActionHandlerParams) -> ActionResult:
    logger.info(
        f"[Custom Handler] Executing get-custom-note for element: {params.element.id}"
    )
    note = params.element.custom_data.get("customNote") if params.element.custom_data else None
    if note is not None:
        return ActionResult(
            success=True,
            message=f"Custom note for {params.element.id}: {note}",
            data={"customNote": note},
        )
    return ActionResult(
        success=False,
        message=f"No customNote found for element {params.element.id}",
    )

async def check_priority_handler(params: CustomActionHandlerParams) -> ActionResult:
    logger.info(
        f"[Custom Handler] Executing check-priority for element: {params.element.id} with args: {params.command_args}"
    )
    if not params.command_args:
        return ActionResult(
            success=False, message="Expected priority argument is missing."
        )
    
    expected_priority_str = params.command_args[0]
    actual_priority = params.element.custom_data.get("itemPriority") if params.element.custom_data else None

    if actual_priority is None:
        return ActionResult(
            success=False,
            message=f"No itemPriority found for element {params.element.id}",
        )

    priority_to_compare: Any = expected_priority_str
    if isinstance(actual_priority, int):
        try:
            priority_to_compare = int(expected_priority_str)
        except ValueError:
            pass # Keep as string if conversion fails, comparison will likely fail as intended

    if actual_priority == priority_to_compare:
        return ActionResult(
            success=True,
            message=f"Priority matches for {params.element.id}. Expected: {expected_priority_str}, Actual: {actual_priority}",
            data={"match": True, "actualPriority": actual_priority},
        )
    return ActionResult(
        success=False,
        message=f"Priority mismatch for {params.element.id}. Expected: {expected_priority_str}, Actual: {actual_priority}",
        data={"match": False, "actualPriority": actual_priority},
    )

# Example of overriding a core command (ported from TS example, commented out)
# async def custom_click_override_handler(params: CustomActionHandlerParams) -> ActionResult:
#     logger.info(f"[Custom Override Handler] Intercepted CLICK on element: {params.element.id}")
#     # You can add custom logic before or after calling the original action
#     # Assuming params.automation provides access to the core automation interface
#     # This part requires careful consideration of how the core automation interface is exposed
#     # to custom handlers in the Python version.
#     # For now, let's assume a direct call like in TS:
#     # result = await params.automation.click(params.element.id) # This line needs mcp-ui-bridge-python to support this
#     
#     # Placeholder if direct automation access isn't straightforwardly available or if we just want to simulate
#     # This might involve calling the original tool explicitly if the bridge allows it,
#     # or it might require the bridge to provide the original function.
#     # For a simple override without calling original:
#     # return ActionResult(success=True, message=f"Clicked {params.element.id} via custom override (simulated)")
#
#     # If we had 'result' from an actual call:
#     # logger.info(f"[Custom Override Handler] Original click action result: {result}")
#     # if result.success:
#     #     result.message = "Clicked via custom override! " + result.message
#     # return result
#     pass # Commented out for now


custom_handlers: list[CustomActionHandler] = [
    CustomActionHandler(
        command_name="get-custom-note", handler=get_custom_note_handler
    ),
    CustomActionHandler(
        command_name="check-priority", handler=check_priority_handler
    ),
    # CustomActionHandler(
    #     command_name="click",
    #     override_core_behavior=True,
    #     handler=custom_click_override_handler # Needs implementation details from mcp-ui-bridge-python
    # ),
]


# --- Server Authentication ---
async def authenticate_client_dummy(context: ClientAuthContext) -> bool:
    logger.info(f"[External Server] Auth attempt. Headers: {context.headers}")
    logger.info(f"[External Server] Auth attempt. Source IP: {context.source_ip}")

    if MANUALLY_ALLOW_CONNECTION:
        logger.info(
            "[External Server] Auth success! (MANUALLY_ALLOW_CONNECTION is true)"
        )
        return True
    else:
        logger.info(
            "[External Server] Auth failed. (MANUALLY_ALLOW_CONNECTION is false)"
        )
        return False

# --- Main Application Logic ---
async def main():
    logger.info("Starting MCP External Server (Python)...")

    options = McpServerOptions(
        target_url="http://localhost:5173",
        port=int(os.getenv("MCP_PORT", "8070")),
        headless_browser=os.getenv("MCP_HEADLESS_BROWSER", "false").lower() == "true",
        server_name="MCP External Server Example with Custom Handlers (Python)",
        server_version="1.0.1",
        server_instructions="This server includes custom commands: get-custom-note #id, check-priority #id <priority>",
        custom_attribute_readers=sample_custom_readers,
        custom_action_handlers=custom_handlers,
        authenticate_client=authenticate_client_dummy,
    )

    try:
        await run_mcp_server(options)
        logger.info(
            f"MCP External Server successfully started and listening on port {options.port}. Targeting {options.target_url}"
        )
    except Exception as e:
        logger.error(f"Failed to start MCP External Server: {e}")
        # In a real app, you might want to sys.exit(1) here
        # For now, just re-raise to see the error during development
        raise

if __name__ == "__main__":
    asyncio.run(main()) 