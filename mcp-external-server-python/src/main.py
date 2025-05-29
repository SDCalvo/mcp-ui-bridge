import sys
import os

# --- Force Python to use the local development version of mcp-ui-bridge-python ---
# Uncomment the following block to use local development version instead of installed package
# # Construct the absolute path to your local mcp-ui-bridge-python directory
# local_lib_path = os.path.abspath(os.path.join(
#     os.path.dirname(__file__),  # Current file's directory (src)
#     '..',                       # Up to mcp-external-server-python
#     '..',                       # Up to "React to terminal conversor"
#     'mcp-ui-bridge-python'      # Down to the library
# ))
# 
# # Check if this path exists and add it to sys.path
# if os.path.isdir(local_lib_path):
#     # Remove any existing paths that might point to a site-packages version of the library
#     sys.path = [p for p in sys.path if 'mcp_ui_bridge_python' not in p.replace('\\', '/').lower()]
#     
#     # Add our local library path to the beginning of sys.path
#     if local_lib_path not in sys.path:
#         sys.path.insert(0, local_lib_path)

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
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Global variable to simulate auth success/failure, similar to MANUALLY_ALLOW_CONNECTION
MANUALLY_ALLOW_CONNECTION = os.getenv("MANUALLY_ALLOW_CONNECTION", "true").lower() == "true"


# --- Custom Attribute Readers ---
def process_item_priority(value: Optional[str], element_handle: Optional[Any] = None) -> Union[int, str, None]:
    """
    Process item priority attribute with access to ElementHandle for advanced processing.
    This demonstrates the feature parity with the TypeScript version.
    """
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
    """Get the custom note from an element's data-mcp-custom-note attribute."""
    logger.info(f"[Custom Handler] Executing get-custom-note for element: {params.element.id}")
    
    # Access the custom data using the correct field name 'customData'
    note = params.element.customData.get("customNote") if params.element.customData else None
    
    if note:
        return ActionResult(
            success=True,
            message=f"Found customNote for element {params.element.id}: '{note}'",
            data={"customNote": note}
        )
    else:
        return ActionResult(
            success=False,
            message=f"No customNote found for element {params.element.id}",
            data=None
        )

async def check_priority_handler(params: CustomActionHandlerParams) -> ActionResult:
    """Check the priority level from an element's data-mcp-item-priority attribute."""
    logger.info(f"[Custom Handler] Executing check-priority for element: {params.element.id}")
    
    # Access the custom data using the correct field name 'customData'
    actual_priority = params.element.customData.get("itemPriority") if params.element.customData else None
    
    if actual_priority is not None:
        return ActionResult(
            success=True,
            message=f"Element {params.element.id} has priority: {actual_priority}",
            data={"itemPriority": actual_priority}
        )
    else:
        return ActionResult(
            success=False,
            message=f"No itemPriority found for element {params.element.id}",
            data=None
        )

# Example of overriding a core command
async def custom_click_override_handler(params: CustomActionHandlerParams) -> ActionResult:
    """
    Custom click handler that overrides the core click behavior.
    This demonstrates the override_core_behavior feature.
    """
    logger.info(f"[Custom Override Handler] Intercepted CLICK on element: {params.element.id}")
    
    # You can add custom logic before calling the original action
    logger.info(f"[Custom Override Handler] Custom pre-click logic for {params.element.id}")
    
    # Call the original click action through the automation interface
    result = await params.automation.click(params.element.id)
    
    # Add custom logic after the original action
    if result.success:
        result.message = f"✨ Clicked via CUSTOM OVERRIDE! {result.message}"
        logger.info(f"[Custom Override Handler] Successfully overrode click for {params.element.id}")
    
    return result

custom_handlers: list[CustomActionHandler] = [
    CustomActionHandler(
        command_name="get-custom-note", handler=get_custom_note_handler
    ),
    CustomActionHandler(
        command_name="check-priority", handler=check_priority_handler
    ),
    # Test override core behavior feature
    CustomActionHandler(
        command_name="click",
        override_core_behavior=True,
        handler=custom_click_override_handler
    ),
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