import asyncio
import json
import logging
import os
import signal
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from fastmcp import (
    FastMCP, 
    Context
)
from .models import ClientAuthContext
from .core.playwright_controller import PlaywrightController, AutomationInterfaceImpl as AsyncAutomationInterfaceImpl
from .core.dom_parser import DomParser
from .models import (
    InteractiveElementInfo,
    ActionResult,
    PlaywrightErrorType,
    McpServerOptions,
    CustomActionHandler,
    CustomActionHandlerParams,
)

from pydantic import BaseModel as PydanticBaseModel
class SendCommandParams(PydanticBaseModel):
    command_string: str

# Configure logging with a proper format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Global Instances ---
playwright_controller: Optional[PlaywrightController] = None
dom_parser: Optional[DomParser] = None
automation_interface: Optional[AsyncAutomationInterfaceImpl] = None
custom_action_handler_map: Dict[str, CustomActionHandler] = {}
mcp_server_instance: Optional[FastMCP] = None # Will be initialized in run_mcp_server

async def initialize_browser_and_dependencies(options: McpServerOptions) -> Tuple[Optional[PlaywrightController], Optional[DomParser], Optional[AsyncAutomationInterfaceImpl]]:
    """
    Initializes the PlaywrightController, DomParser, and AutomationInterface.
    Returns a tuple (playwright_controller, dom_parser, automation_interface).
    Returns (None, None, None) if initialization fails.
    """
    global playwright_controller # Ensure we assign to the global instance
    
    temp_playwright_controller: Optional[PlaywrightController] = None # Use a temporary variable
    try:
        temp_playwright_controller = PlaywrightController(
            launch_options={"headless": options.headless_browser},
            custom_attribute_readers=options.custom_attribute_readers
        )
    except Exception as e_pc_init:
        logger.error("[mcp_server.py] Exception during PlaywrightController instantiation", exc_info=True)
        return None, None, None

    # Assign to global after successful instantiation
    playwright_controller = temp_playwright_controller

    # Launch Playwright
    launch_result: Optional[ActionResult] = None
    try:
        if playwright_controller: # Check if it was successfully created
            launch_result = await playwright_controller.launch()
        else:
            logger.error("[mcp_server.py] PlaywrightController was not instantiated. Cannot launch.")
            return None, None, None # Should not happen if previous try-except is correct
    except Exception as e_launch:
        logger.error("[mcp_server.py] Exception during playwright_controller.launch", exc_info=True)
        if playwright_controller: await playwright_controller.close()
        return None, None, None

    if not launch_result or not launch_result.success or not (playwright_controller and playwright_controller.page):
        logger.error(f"[mcp_server.py] PlaywrightController launch failed: {launch_result.message if launch_result else 'No launch result'}")
        if playwright_controller: await playwright_controller.close()
        return None, None, None

    # Navigate to the target URL
    if options.target_url:
        nav_result: Optional[ActionResult] = None
        try:
            if playwright_controller: # Check again
                nav_result = await playwright_controller.navigate(options.target_url)
                if not nav_result or not nav_result.success:
                    logger.error(f"[mcp_server.py] Failed to navigate to {options.target_url}. Message: {nav_result.message if nav_result else 'No navigation result'}")
                    await playwright_controller.close()
                    return None, None, None
            else: # Should not be reachable if logic is correct
                logger.error("[mcp_server.py] PlaywrightController not available for navigation.")
                return None, None, None
        except Exception as e_nav:
            logger.error("[mcp_server.py] Exception during navigation", exc_info=True)
            if playwright_controller: await playwright_controller.close()
            return None, None, None
    else:
        logger.warning("[mcp_server.py] No target_url provided in options. Browser will remain on about:blank")

    global dom_parser # Ensure we assign to the global instance
    temp_dom_parser: Optional[DomParser] = None
    try:
        if playwright_controller: # Check again
            temp_dom_parser = DomParser(
                page=playwright_controller.get_page(), 
                custom_attribute_readers=options.custom_attribute_readers
            )
        else: # Should not be reachable
            logger.error("[mcp_server.py] PlaywrightController not available for DomParser initialization.")
            return None, None, None
    except Exception as e_dp:
        logger.error("[mcp_server.py] Failed to initialize DomParser", exc_info=True)
        if playwright_controller: await playwright_controller.close()
        return None, None, None
    
    dom_parser = temp_dom_parser

    global automation_interface # Ensure we assign to the global instance
    temp_automation_interface: Optional[AsyncAutomationInterfaceImpl] = None
    try:
        if playwright_controller: # Check again
            temp_automation_interface = AsyncAutomationInterfaceImpl(playwright_controller=playwright_controller)
        else: # Should not be reachable
             logger.error("[mcp_server.py] PlaywrightController not available for AutomationInterface initialization.")
             return None, None, None
    except Exception as e_ai:
        logger.error("[mcp_server.py] Failed to initialize AutomationInterface", exc_info=True)
        if playwright_controller: await playwright_controller.close()
        return None, None, None
    
    automation_interface = temp_automation_interface
    
    logger.info("[mcp_server.py] MCP UI Bridge components initialized successfully")
    return playwright_controller, dom_parser, automation_interface

async def _get_current_screen_data_execute_impl() -> Dict[str, Any]:
    """Core logic for the get_current_screen_data tool."""
    global dom_parser, playwright_controller

    if not dom_parser or not playwright_controller or not playwright_controller.get_page():
        logger.error(
            "[mcp_server.py] get_current_screen_data: DomParser or PlaywrightController not initialized."
        )
        return {
            "success": False,
            "message": "Server components not initialized.",
            "error_type": PlaywrightErrorType.NotInitialized.value
        }
    
    try:
        page = playwright_controller.get_page()
        if not page or page.is_closed():
            logger.warning("[mcp_server.py] get_current_screen_data: Page is closed or not available.")
            return {
                "success": False,
                "message": "Page is closed or not available. Cannot retrieve screen data.",
                "error_type": PlaywrightErrorType.PageNotAvailable.value
            }

        # Direct synchronous calls
        structured_data_result = await dom_parser.get_structured_data()
        interactive_elements_result = await dom_parser.get_interactive_elements_with_state()
        
        current_url = await page.evaluate("() => window.location.href")

        structured_data_payload = {
            "containers": [], "regions": [], "statusMessages": [], "loadingIndicators": []
        }
        if structured_data_result.success and structured_data_result.data:
            structured_data_payload = structured_data_result.data
        
        interactive_elements_payload = []
        if interactive_elements_result.success and interactive_elements_result.data:
            interactive_elements_payload = [el.model_dump() for el in interactive_elements_result.data]

        return {
            "success": True,
            "currentUrl": current_url,
            "data": {
                "structuredData": structured_data_payload,
                "interactiveElements": interactive_elements_payload,
            },
            "parserMessages": {
                "structured": structured_data_result.message,
                "interactive": interactive_elements_result.message,
            },
        }
    except Exception as error:
        logger.exception("[mcp_server.py] Error in get_current_screen_data_execute:")
        return {
            "success": False,
            "message": f"Error fetching screen data: {str(error)}",
            "error_type": PlaywrightErrorType.ActionFailed.value
        }

async def _get_current_screen_actions_execute_impl() -> Dict[str, Any]:
    """Core logic for the get_current_screen_actions tool."""
    # ORIGINAL COMPLEX VERSION - NOW ACTIVE
    global dom_parser, playwright_controller
    
    if not dom_parser or not playwright_controller or not playwright_controller.get_page():
        logger.error(
            "[mcp_server.py] get_current_screen_actions: DomParser or PlaywrightController not initialized."
        )
        return {
            "success": False,
            "message": "Server components not initialized.",
            "actions": [],
            "error_type": PlaywrightErrorType.NotInitialized.value
        }

    logger.info("[mcp_server.py] get_current_screen_actions: Fetching actions...")
    
    page = playwright_controller.get_page()
    if not page or page.is_closed():
        logger.warning("[mcp_server.py] get_current_screen_actions: Page is closed or not available.")
        return {
            "success": False,
            "message": "Page is closed. Cannot retrieve screen actions.",
            "error_type": PlaywrightErrorType.PageNotAvailable.value,
            "actions": []
        }

    try:
        # Direct synchronous call
        interactive_elements_result = await dom_parser.get_interactive_elements_with_state()

        if not interactive_elements_result.success or not interactive_elements_result.data:
            return {
                "success": False,
                "message": f"Failed to get interactive elements: {interactive_elements_result.message}",
                "actions": [],
                "error_type": (interactive_elements_result.error_type.value 
                               if interactive_elements_result.error_type 
                               else PlaywrightErrorType.ActionFailed.value)
            }

        actions = []
        for el_info_model in interactive_elements_result.data:
            # Convert Pydantic model to dict for easier processing here, similar to TS object
            el = el_info_model.model_dump()
            
            generated_actions: List[Dict[str, Any]] = []

            # Default click action for many elements
            if (
                el.get("elementType") == "button" or
                el.get("elementType") == "input-button" or
                el.get("elementType") == "input-submit" or
                el.get("elementType") == "a" or
                (el.get("elementType") and not el.get("elementType").startswith("input-"))
            ):
                generated_actions.append({
                    "id": el.get("id"),
                    "label": el.get("label"),
                    "elementType": el.get("elementType"),
                    "purpose": el.get("purpose"),
                    "commandHint": f"click #{el.get('id')}",
                    "currentValue": el.get("currentValue"),
                    "isChecked": el.get("isChecked"),
                    "isDisabled": el.get("isDisabled"),
                    "isReadOnly": el.get("isReadOnly"),
                })

            # Type action for text inputs
            if (
                (el.get("elementType", "").startswith("input-") and
                el.get("elementType") not in [
                    "input-button", "input-submit", "input-checkbox", "input-radio",
                    "input-file", "input-reset", "input-image", "input-color", "input-range",
                    "input-date", "input-month", "input-week", "input-time", "input-datetime-local",
                ]) or
                el.get("elementType") == "textarea"
            ):
                generated_actions.append({
                    "id": el.get("id"),
                    "label": el.get("label"),
                    "elementType": el.get("elementType"),
                    "purpose": el.get("purpose"),
                    "commandHint": f"type #{el.get('id')} \"<text_to_type>\"",
                    "currentValue": el.get("currentValue"),
                    "isChecked": el.get("isChecked"),
                    "isDisabled": el.get("isDisabled"),
                    "isReadOnly": el.get("isReadOnly"),
                })

            # Select action for select elements
            if el.get("elementType") == "select" and el.get("options"):
                generated_actions.append({
                    "id": el.get("id"),
                    "label": el.get("label"),
                    "elementType": el.get("elementType"),
                    "purpose": el.get("purpose"),
                    "commandHint": f"select #{el.get('id')} \"<value_to_select>\"",
                    "currentValue": el.get("currentValue"),
                    "options": [{ "value": opt.get("value"), "text": opt.get("text") } for opt in el.get("options", [])],
                    "isDisabled": el.get("isDisabled"),
                    "isReadOnly": el.get("isReadOnly"),
                })

            # Check/uncheck for checkboxes
            if el.get("elementType") == "input-checkbox":
                generated_actions.append({
                    "id": el.get("id"),
                    "label": el.get("label"),
                    "elementType": el.get("elementType"),
                    "purpose": el.get("purpose"),
                    "commandHint": f"uncheck #{el.get('id')}" if el.get("isChecked") else f"check #{el.get('id')}",
                    "currentValue": el.get("currentValue"),
                    "isChecked": el.get("isChecked"),
                    "isDisabled": el.get("isDisabled"),
                    "isReadOnly": el.get("isReadOnly"),
                })

            # Choose for radio buttons
            if el.get("elementType") == "input-radio":
                command_hint = f"choose #{el.get('id')}"
                if el.get("radioGroup"):
                    command_hint += f" in_group {el.get('radioGroup')}"
                generated_actions.append({
                    "id": el.get("id"),
                    "label": el.get("label"),
                    "radioGroup": el.get("radioGroup"),
                    "elementType": el.get("elementType"),
                    "purpose": el.get("purpose"),
                    "commandHint": command_hint,
                    "currentValue": el.get("currentValue"), 
                    "isChecked": el.get("isChecked"),
                    "isDisabled": el.get("isDisabled"),
                    "isReadOnly": el.get("isReadOnly"),
                })
            actions.extend(generated_actions)
        
        return {"success": True, "actions": actions}

    except Exception as error:
        logger.exception("[mcp_server.py] Error in get_current_screen_actions_execute:")
        return {
            "success": False,
            "message": f"Error fetching screen actions: {str(error)}",
            "actions": [],
            "error_type": PlaywrightErrorType.ActionFailed.value
        }

async def _send_command_tool_execute_impl(params: SendCommandParams, ctx: Context) -> Dict[str, Any]:
    """Core logic for the send_command tool."""
    global playwright_controller, automation_interface, custom_action_handler_map

    if not playwright_controller or not automation_interface:
        logger.error(
            "[mcp_server.py] send_command: PlaywrightController or AutomationInterface not initialized."
        )
        return {
            "success": False,
            "message": "Server components not initialized.",
            "error_type": PlaywrightErrorType.NotInitialized.value
        }

    command_string = params.command_string.strip()
    await ctx.info(f"Executing command: {command_string}") # Example of using context

    import re
    match = re.match(r"(\S+)(?:\s+#([^\s]+))?(.*)", command_string)
    if not match:
        logger.warning("[mcp_server.py] Unrecognized command format.")
        return {
            "success": False,
            "message": "Invalid command string format.",
            "error_type": PlaywrightErrorType.InvalidInput.value
        }

    command_name = match.group(1).lower()
    element_id = match.group(2)  # Can be None
    remaining_args_string = match.group(3).strip() if match.group(3) else ""

    command_args: List[str] = []
    if remaining_args_string:
        # Basic argument splitting (handles simple quoted arguments)
        arg_regex = r'"[^"]+"|\S+'
        for arg_match in re.finditer(arg_regex, remaining_args_string):
            command_args.append(arg_match.group(0).strip('"'))

    result: ActionResult
    
    # --- Custom Handler Check ---
    custom_handler = custom_action_handler_map.get(command_name)

    if custom_handler:
        logger.info(f"[mcp_server.py] Custom handler found for command \"{command_name}\".")
        if not element_id and command_name not in ["navigate"]: # Example: navigate might not need an elementId
            logger.warning(f"[mcp_server.py] Command \"{command_name}\" likely requires an element ID (#elementId) but none was provided.")
            # Depending on handler, this might be an error or handled by the handler itself
            # For now, proceeding, handler must validate.

        target_element_info: Optional[InteractiveElementInfo] = None
        if element_id:
            # Direct synchronous call
            state_result = await playwright_controller.get_element_state(element_id)
            if not state_result.success or not state_result.data:
                logger.warning(f"[mcp_server.py] Failed to get state for element #{element_id} for custom handler: {state_result.message}")
                return {
                    "success": False,
                    "message": f"Failed to get element state for #{element_id}: {state_result.message}",
                    "error_type": (state_result.error_type.value if state_result.error_type 
                                   else PlaywrightErrorType.ElementNotFound.value)
                }
            if isinstance(state_result.data, InteractiveElementInfo):
                target_element_info = state_result.data
            else:
                 logger.error(f"[mcp_server.py] Element state for {element_id} is not of type InteractiveElementInfo.")

        try:
            handler_params = CustomActionHandlerParams(
                element=target_element_info, 
                command_args=command_args, 
                automation=automation_interface # This is AutomationInterfaceImpl (Sync)
            )
            # The type hint for CustomActionHandler.handler is Callable[[CustomActionHandlerParams], Awaitable[ActionResult]]
            # so it must be awaited.
            result = await custom_handler.handler(handler_params)
            logger.info(f"[mcp_server.py] Custom handler for \"{command_name}\" executed.")
            return result.model_dump()
        except Exception as e:
            logger.exception(f"[mcp_server.py] Error in custom handler for \"{command_name}\":")
            return {
                "success": False,
                "message": f"Error executing custom handler for \"{command_name}\": {str(e)}",
                "error_type": PlaywrightErrorType.ActionFailed.value
            }
    elif (
        command_name in ["click", "type", "select", "check", "uncheck", "choose"] and 
        command_name in custom_action_handler_map and 
        not custom_action_handler_map[command_name].override_core_behavior
    ):
        pass  # Proceed with core logic

    # --- Core Command Logic (if no custom handler or not overridden) ---
    if not element_id and command_name in ["click", "type", "select", "check", "uncheck", "choose"]:
        logger.warning(f"[mcp_server.py] Core command \"{command_name}\" requires an element ID (#elementId) but none was provided.")
        return {
            "success": False, 
            "message": f"Core command \"{command_name}\" requires an element ID.", 
            "error_type": PlaywrightErrorType.InvalidInput.value
        }

    # Direct synchronous calls
    if command_name == "click" and element_id:
        result = await playwright_controller.click(element_id)
    elif command_name == "type" and element_id and command_args:
        text_to_type = command_args[0]
        result = await playwright_controller.type_text(element_id, text_to_type)
    elif command_name == "select" and element_id and command_args:
        value_to_select = command_args[0]
        result = await playwright_controller.select_option(element_id, value_to_select)
    elif command_name == "check" and element_id:
        result = await playwright_controller.check_element(element_id)
    elif command_name == "uncheck" and element_id:
        result = await playwright_controller.uncheck_element(element_id)
    elif command_name == "choose" and element_id: 
        value_to_select = command_args[0] if command_args else element_id
        result = await playwright_controller.select_radio_button(element_id, value_to_select)
    elif command_name == "scroll-up":
        logger.info("[mcp_server.py] Executing core scroll up")
        result = await playwright_controller.scroll_page_up()
    elif command_name == "scroll-down":
        logger.info("[mcp_server.py] Executing core scroll down")
        result = await playwright_controller.scroll_page_down()
    elif not custom_action_handler_map.get(command_name): # Only if no custom handler was defined AT ALL
        logger.warning(f"[mcp_server.py] Unrecognized command: {command_name}")
        result = ActionResult(
            success=False,
            message=f"Command \"{command_name}\" is not a recognized core command and no custom handler is registered for it.",
            error_type=PlaywrightErrorType.InvalidInput
        )
    else: # Command matched a custom handler name, but override_core_behavior was false, and it wasn't a known core command.
          # This case should ideally not be hit if logic is correct, means it's an unhandled non-core custom command.
        result = ActionResult(
            success=False,
            message=f"Command \"{command_name}\" was not executed. It may be a custom command with overrideCoreBehavior=false that doesn't match a core action.",
            error_type=PlaywrightErrorType.InvalidInput
        )

    return result.model_dump() # Return dict directly

# --- Server Setup and Lifecycle ---

async def run_mcp_server(options: McpServerOptions) -> None:
    """
    Initializes and starts the FastMCP server with all defined tools.
    Handles graceful shutdown on SIGINT/SIGTERM.
    """
    global mcp_server_instance, playwright_controller, dom_parser, automation_interface

    if not options:
        logger.error("[mcp_server.py] McpServerOptions are required to run the server.")
        raise ValueError("McpServerOptions are required.")

    # Initialize FastMCP instance first
    auth_callback: Optional[Callable[[ClientAuthContext], Awaitable[bool]]] = None
    if options.authenticate_client:
        auth_callback = options.authenticate_client
    
    try:
        mcp_server_instance = FastMCP(
            title=options.server_name,
            description=options.server_instructions,
            version=options.server_version,
            authenticate_client=auth_callback
        )
    except Exception as e:
        logger.exception("[mcp_server.py] Failed to create FastMCP server instance")
        return

    # Now initialize browser and other dependencies
    init_pw, init_dp, init_ai = await initialize_browser_and_dependencies(options)

    if not init_pw or not init_dp or not init_ai:
        logger.critical("[mcp_server.py] Critical error during browser/dependencies initialization. Server cannot start.")
        return

    # Register custom action handlers from options
    global custom_action_handler_map
    if options.custom_action_handlers:
        for handler in options.custom_action_handlers:
            if handler.command_name in custom_action_handler_map and not handler.override_core_behavior:
                logger.warning(f"[mcp_server.py] Custom handler for command '{handler.command_name}' already exists and override_core_behavior is False. Skipping duplicate.")
            else:
                custom_action_handler_map[handler.command_name] = handler

    # Tool definitions using decorators
    if not mcp_server_instance:
        logger.error("[mcp_server.py] mcp_server_instance is None before tool decoration. This is a bug.")
        return # Cannot proceed to decorate tools

    @mcp_server_instance.tool(name="get_current_screen_data", description="Retrieves structured data and interactive elements from the current web page view.")
    async def get_current_screen_data_execute() -> Dict[str, Any]:
        return await _get_current_screen_data_execute_impl()

    @mcp_server_instance.tool(name="list_actions", description="Retrieves a list of possible actions (like click, type) for interactive elements on the current screen.")
    async def list_actions_execute() -> Dict[str, Any]:
        return await _get_current_screen_actions_execute_impl()

    @mcp_server_instance.tool(name="send_command", description='Sends a command to interact with the web page (e.g., click button, type text, scroll). Command format: "action #elementId arguments...". Supported actions: click, type, select, check, uncheck, choose, scroll-up, scroll-down.')
    async def send_command_tool_execute(params: SendCommandParams, ctx: Context) -> Dict[str, Any]:
        return await _send_command_tool_execute_impl(params, ctx)

    logger.info("[mcp_server.py] Tools defined and decorated for FastMCP.")

    host = options.host
    port = options.port
    
    # The old 'tools' list definition is removed.
    # Manual Uvicorn setup (uvicorn.Config, uvicorn.Server, uv_server.serve()) is removed.
    # The call to mcp_server_instance.run_async() will be added in a later step.

    # For now, ensure signal handlers are still managed correctly if run_async is not yet called
    # This finally block might be premature without the main server loop,
    # but let's keep the structure for graceful_shutdown.
    original_sigint_handler = signal.getsignal(signal.SIGINT)
    original_sigterm_handler = signal.getsignal(signal.SIGTERM)

    try:
        # In the next steps, we will add tool definitions and the mcp_server_instance.run_async() call here.
        logger.info(f"[mcp_server.py] Starting FastMCP server with run_async() on {host}:{port}, path /mcp")
        if not mcp_server_instance: # Should be created above
             logger.error("[mcp_server.py] mcp_server_instance is None before run_async. FATAL.")
             if playwright_controller: await playwright_controller.close() # Best effort
             return

        await mcp_server_instance.run_async(
            transport="streamable-http",
            host=host,
            port=port,
            path="/mcp" # Default path for streamable-http
        )
        logger.info("[mcp_server.py] mcp_server_instance.run_async() completed or was interrupted.")

    except KeyboardInterrupt: 
        logger.info("[mcp_server.py] run_async() caught KeyboardInterrupt. Server shutting down.")
    except asyncio.CancelledError:
        logger.info("[mcp_server.py] mcp_server_instance.run_async() task was cancelled.")
    except Exception as e:
        logger.error(f"[mcp_server.py] mcp_server_instance.run_async() exited with error: {e}", exc_info=True)
    finally:
        logger.info("[mcp_server.py] mcp_server_instance.run_async() has finished or was interrupted. Performing graceful shutdown.")
        signal.signal(signal.SIGINT, original_sigint_handler)
        signal.signal(signal.SIGTERM, original_sigterm_handler)
        
        await graceful_shutdown() 

async def graceful_shutdown(sig: Optional[signal.Signals] = None) -> None:
    """Handles graceful shutdown of Playwright resources."""
    global playwright_controller # mcp_server_instance shutdown is handled by Uvicorn loop

    if sig: # This function might be called directly from run_mcp_server's finally too
        logger.info(f"[mcp_server.py] Graceful shutdown triggered by signal {sig.name} (via Uvicorn).")
    else:
        logger.info("[mcp_server.py] Graceful shutdown triggered post-Uvicorn stop.")

    if playwright_controller:
        logger.info("[mcp_server.py] Closing Playwright resources...")
        try:
            await playwright_controller.close()
            logger.info("[mcp_server.py] Playwright resources closed.")
        except Exception as e:
            logger.error(f"[mcp_server.py] Error closing PlaywrightController: {e}", exc_info=True)
    
    logger.info("[mcp_server.py] Graceful shutdown sequence complete.")

# --- Main Entry Point ---

async def main(config_path: Optional[str] = None) -> None:
    """
    Main entry point for the MCP UI Bridge server - primarily for mcp_server.py direct run.
    The mcp_ui_bridge_python.main (Typer app) is the preferred CLI entry point.
    This function loads configuration and runs the server.
    """
    logger.info("[mcp_server.py] MCP UI Bridge (Python) starting...")

    options: Optional[McpServerOptions] = None

    if config_path:
        logger.info(f"[mcp_server.py] Loading configuration from: {config_path}")
        try:
            config_file = Path(config_path)
            if not config_file.is_file():
                logger.error(f"[mcp_server.py] Configuration file not found: {config_path}")
                return
            
            config_data = json.loads(config_file.read_text())
            options = McpServerOptions(**config_data)
            logger.info("[mcp_server.py] Configuration loaded and parsed successfully.")
        except FileNotFoundError:
            logger.error(f"[mcp_server.py] Configuration file not found at {config_path}. Using default options or environment variables if set.")
            return
        except json.JSONDecodeError as e:
            logger.exception("[mcp_server.py] Error decoding JSON from configuration file")
            return
        except Exception as e:
            logger.exception("[mcp_server.py] Error processing configuration")
            return
    else:
        logger.info("[mcp_server.py] No configuration file provided. Using default McpServerOptions.")
        options = McpServerOptions(
            target_url=os.environ.get("MCP_TARGET_URL", "http://localhost:5173"),
            headless_browser=os.environ.get("MCP_HEADLESS", "true").lower() == "true",
            port=int(os.environ.get("MCP_PORT", 7860)),
            host=os.environ.get("MCP_HOST", "0.0.0.0")
        )
        logger.info(f"[mcp_server.py] Default options: Target URL='{options.target_url}', Headless={options.headless_browser}, Port={options.port}")

    if not options.target_url:
        logger.error("[mcp_server.py] CRITICAL: target_url is not configured. Please provide it via config file or MCP_TARGET_URL environment variable.")
        return

    await run_mcp_server(options)

if __name__ == "__main__":
    # This allows running the server directly using `python -m mcp_ui_bridge_python.mcp_server`
    # or `python path/to/mcp_server.py`
    # You might use a CLI library like Typer or Click here to accept --config argument
    
    # Simple argument parsing for config file for now
    import sys
    config_file_path: Optional[str] = None
    if len(sys.argv) > 1:
        if sys.argv[1] == "--config" and len(sys.argv) > 2:
            config_file_path = sys.argv[2]
            logger.info(f"[mcp_server.py] Config file specified via CLI: {config_file_path}")
        elif not sys.argv[1].startswith("--"):
             # Legacy: assume first arg without -- is config path
            config_file_path = sys.argv[1]
            logger.info(f"[mcp_server.py] Config file specified via CLI (legacy): {config_file_path}")
        else:
            logger.warning(f"[mcp_server.py] Unrecognized CLI argument: {sys.argv[1]}. Use --config <path>.")

    try:
        asyncio.run(main(config_path=config_file_path))
    except KeyboardInterrupt:
        logger.info("[mcp_server.py] Main process interrupted (asyncio.run). This should ideally be handled by Uvicorn's shutdown or our graceful_shutdown.")
        # If playwright_controller is still alive, attempt a last-ditch close.
        # This path is less ideal as graceful_shutdown should have been called.
        if playwright_controller and playwright_controller.get_page() and not playwright_controller.get_page().is_closed():
            logger.warning("[mcp_server.py] Attempting emergency Playwright close from main KeyboardInterrupt.")
            try:
                # This is tricky because the loop from asyncio.run() is stopping.
                # A direct await might not work.
                # For simplicity, relying on the finally block in run_mcp_server.
                pass 
            except Exception as e_final_close:
                logger.error(f"[mcp_server.py] Error in emergency Playwright close: {e_final_close}")

    except Exception as e:
        logger.exception("[mcp_server.py] Unhandled exception in main top-level asyncio.run")
        # Similar emergency close attempt
        if playwright_controller and playwright_controller.get_page() and not playwright_controller.get_page().is_closed():
            logger.warning("[mcp_server.py] Attempting emergency Playwright close from main unhandled exception.")
            # Relying on finally in run_mcp_server for cleanup.
            pass

    logger.info("[mcp_server.py] Application exiting.")
