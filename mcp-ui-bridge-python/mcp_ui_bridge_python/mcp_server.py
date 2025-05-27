print("--- DIAGNOSTIC: Top of mcp-external-server-python/src/main.py ---")
import asyncio
import json
import logging
import os
import signal
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple
import traceback

# Adjusted FastMCP imports
from fastmcp import (
    FastMCP, 
    Context
)
# Attempt to import ClientAuthContext from the local .models module
from .models import ClientAuthContext
from .core.playwright_controller import PlaywrightController, AutomationInterfaceImpl as AsyncAutomationInterfaceImpl
from .core.dom_parser import DomParser
from .models import (
    InteractiveElementInfo,
    ActionResult,
    PlaywrightErrorType,
    DomParserErrorType,
    McpServerOptions,
    ParserResult,
    DisplayContainerInfo,
    PageRegionInfo,
    StatusMessageAreaInfo,
    LoadingIndicatorInfo,
    CustomAttributeReader,
    CustomActionHandler,
    AutomationInterface, 
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

logger.info("[mcp_server.py] Initializing MCP server logic...")

# --- Global Instances ---
playwright_controller: Optional[PlaywrightController] = None
dom_parser: Optional[DomParser] = None
automation_interface: Optional[AsyncAutomationInterfaceImpl] = None
custom_action_handler_map: Dict[str, CustomActionHandler] = {}
mcp_server_instance: Optional[FastMCP] = None

async def initialize_browser_and_dependencies(options: McpServerOptions) -> Tuple[Optional[PlaywrightController], Optional[DomParser], Optional[AsyncAutomationInterfaceImpl]]:
    """
    Initializes the PlaywrightController, DomParser, and AutomationInterface.
    Returns a tuple (playwright_controller, dom_parser, automation_interface).
    Returns (None, None, None) if initialization fails.
    """
    global playwright_controller # Ensure we assign to the global instance
    logger.info("[mcp_server.py] Starting browser and dependencies initialization...")
    logger.info(f"[mcp_server.py] Options received: headless={options.headless_browser}, target_url={options.target_url}")
    
    temp_playwright_controller: Optional[PlaywrightController] = None # Use a temporary variable
    try:
        logger.info("[mcp_server.py] Creating PlaywrightController instance...")
        temp_playwright_controller = PlaywrightController(
            launch_options={"headless": options.headless_browser},
            custom_attribute_readers=options.custom_attribute_readers
        )
        logger.info("[mcp_server.py] PlaywrightController instance created successfully")
    except Exception as e_pc_init:
        logger.error("[mcp_server.py] Exception during PlaywrightController instantiation", exc_info=True)
        return None, None, None

    # Assign to global after successful instantiation
    playwright_controller = temp_playwright_controller

    # Launch Playwright
    launch_result: Optional[ActionResult] = None
    try:
        logger.info("[mcp_server.py] Attempting to launch Playwright browser...")
        if playwright_controller: # Check if it was successfully created
            launch_result = await playwright_controller.launch()
            logger.info(f"[mcp_server.py] Launch result: success={launch_result.success if launch_result else 'N/A'}, message={launch_result.message if launch_result else 'N/A'}")
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
    
    logger.info("[mcp_server.py] PlaywrightController launched successfully")

    # Navigate to the target URL
    if options.target_url:
        logger.info(f"[mcp_server.py] Attempting to navigate to target URL: {options.target_url}...")
        nav_result: Optional[ActionResult] = None
        try:
            if playwright_controller: # Check again
                nav_result = await playwright_controller.navigate(options.target_url)
                logger.info(f"[mcp_server.py] Navigation result: success={nav_result.success if nav_result else 'N/A'}, message={nav_result.message if nav_result else 'N/A'}")
                if not nav_result or not nav_result.success:
                    logger.error(f"[mcp_server.py] Failed to navigate to {options.target_url}. Message: {nav_result.message if nav_result else 'No navigation result'}")
                    await playwright_controller.close()
                    return None, None, None
                logger.info(f"[mcp_server.py] Successfully navigated to {options.target_url}")
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
    logger.info("[mcp_server.py] Initializing DomParser...")
    try:
        if playwright_controller: # Check again
            temp_dom_parser = DomParser(
                page=playwright_controller.get_page(), 
                custom_attribute_readers=options.custom_attribute_readers
            )
            logger.info("[mcp_server.py] DomParser initialized successfully")
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
    logger.info("[mcp_server.py] Initializing AutomationInterface...")
    try:
        if playwright_controller: # Check again
            temp_automation_interface = AsyncAutomationInterfaceImpl(playwright_controller=playwright_controller)
            logger.info("[mcp_server.py] AutomationInterface initialized successfully")
        else: # Should not be reachable
             logger.error("[mcp_server.py] PlaywrightController not available for AutomationInterface initialization.")
             return None, None, None
    except Exception as e_ai:
        logger.error("[mcp_server.py] Failed to initialize AutomationInterface", exc_info=True)
        if playwright_controller: await playwright_controller.close()
        return None, None, None
    
    automation_interface = temp_automation_interface
    
    logger.info("[mcp_server.py] All components initialized successfully")
    return playwright_controller, dom_parser, automation_interface

# --- Tool Execution Logic --- 

async def get_current_screen_data_execute() -> str:
    """Core logic for the get_current_screen_data tool."""
    global dom_parser, playwright_controller

    if not dom_parser or not playwright_controller or not playwright_controller.get_page():
        logger.error(
            "[mcp_server.py] get_current_screen_data: DomParser or PlaywrightController not initialized."
        )
        return json.dumps({
            "success": False,
            "message": "Server components not initialized.",
            "error_type": PlaywrightErrorType.NotInitialized.value # Use .value for enums in JSON
        })
    
    logger.info("[mcp_server.py] get_current_screen_data: Fetching data...")
    try:
        page = playwright_controller.get_page()
        if not page or page.is_closed(): # Check if page is None as well
            logger.warning("[mcp_server.py] get_current_screen_data: Page is closed or not available.")
            return json.dumps({
                "success": False,
                "message": "Page is closed or not available. Cannot retrieve screen data.",
                "error_type": PlaywrightErrorType.PageNotAvailable.value
            })

        # These are synchronous calls from DomParser
        # Consider asyncio.to_thread if these are blocking in an async context
        structured_data_result = await asyncio.to_thread(dom_parser.get_structured_data)
        interactive_elements_result = await asyncio.to_thread(dom_parser.get_interactive_elements_with_state)
        
        current_url = page.url

        # Ensure data fields are present with empty defaults if parsing failed or returned no data
        structured_data_payload = {
            "containers": [], "regions": [], "status_messages": [], "loading_indicators": []
        }
        if structured_data_result.success and structured_data_result.data:
            structured_data_payload = structured_data_result.data
        
        interactive_elements_payload = []
        if interactive_elements_result.success and interactive_elements_result.data:
            interactive_elements_payload = [el.model_dump(by_alias=True) for el in interactive_elements_result.data]
            # Use model_dump for Pydantic models to get dicts suitable for JSON

        return json.dumps({
            "success": True,
            "current_url": current_url,
            "data": {
                "structured_data": structured_data_payload,
                "interactive_elements": interactive_elements_payload,
            },
            "parser_messages": {
                "structured": structured_data_result.message,
                "interactive": interactive_elements_result.message,
            },
        })
    except Exception as error:
        logger.exception("[mcp_server.py] Error in get_current_screen_data_execute:")
        return json.dumps({
            "success": False,
            "message": f"Error fetching screen data: {str(error)}",
            "error_type": PlaywrightErrorType.ActionFailed.value
        })

async def get_current_screen_actions_execute() -> str:
    """Core logic for the get_current_screen_actions tool."""
    global dom_parser, playwright_controller

    if not dom_parser or not playwright_controller or not playwright_controller.get_page():
        logger.error(
            "[mcp_server.py] get_current_screen_actions: DomParser or PlaywrightController not initialized."
        )
        return json.dumps({
            "success": False,
            "message": "Server components not initialized.",
            "actions": [],
            "error_type": PlaywrightErrorType.NotInitialized.value
        })

    logger.info("[mcp_server.py] get_current_screen_actions: Fetching actions...")
    
    page = playwright_controller.get_page()
    if not page or page.is_closed():
        logger.warning("[mcp_server.py] get_current_screen_actions: Page is closed or not available.")
        return json.dumps({
            "success": False,
            "message": "Page is closed. Cannot retrieve screen actions.",
            "error_type": PlaywrightErrorType.PageNotAvailable.value,
            "actions": []
        })

    try:
        # Call the synchronous method in a separate thread
        interactive_elements_result = await asyncio.to_thread(dom_parser.get_interactive_elements_with_state)

        if not interactive_elements_result.success or not interactive_elements_result.data:
            return json.dumps({
                "success": False,
                "message": f"Failed to get interactive elements: {interactive_elements_result.message}",
                "actions": [],
                "error_type": (interactive_elements_result.error_type.value 
                               if interactive_elements_result.error_type 
                               else PlaywrightErrorType.ActionFailed.value)
            })

        actions = []
        for el_info_model in interactive_elements_result.data:
            # Convert Pydantic model to dict for easier processing here, similar to TS object
            el = el_info_model.model_dump(by_alias=True)
            
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
                (el.get("elementType"," ").startswith("input-") and
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
        
        return json.dumps({"success": True, "actions": actions})

    except Exception as error:
        logger.exception("[mcp_server.py] Error in get_current_screen_actions_execute:")
        return json.dumps({
            "success": False,
            "message": f"Error fetching screen actions: {str(error)}",
            "actions": [],
            "error_type": PlaywrightErrorType.ActionFailed.value
        })

async def send_command_tool_execute(params: SendCommandParams) -> str:
    """Core logic for the send_command tool."""
    global playwright_controller, automation_interface, custom_action_handler_map

    if not playwright_controller or not automation_interface:
        logger.error(
            "[mcp_server.py] send_command: PlaywrightController or AutomationInterface not initialized."
        )
        return json.dumps({
            "success": False,
            "message": "Server components not initialized.",
            "error_type": PlaywrightErrorType.NotInitialized.value
        })

    command_string = params.command_string.strip()
    logger.info(f"[mcp_server.py] Received command: {command_string}")

    # --- Command Parsing (adapted from TS version) ---
    import re
    match = re.match(r"(\S+)(?:\s+#([^\s]+))?(.*)", command_string)
    if not match:
        logger.warning("[mcp_server.py] Unrecognized command format.")
        return json.dumps({
            "success": False,
            "message": "Invalid command string format.",
            "error_type": PlaywrightErrorType.InvalidInput.value
        })

    command_name = match.group(1).lower()
    element_id = match.group(2)  # Can be None
    remaining_args_string = match.group(3).strip() if match.group(3) else ""

    command_args: List[str] = []
    if remaining_args_string:
        # Basic argument splitting (handles simple quoted arguments)
        arg_regex = r'"[^"]+"|\S+'
        for arg_match in re.finditer(arg_regex, remaining_args_string):
            command_args.append(arg_match.group(0).strip('"'))

    logger.info(
        f"[mcp_server.py] Parsed Command: name='{command_name}', element_id='{element_id}', args={command_args}"
    )

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
            # get_element_state is sync, run in thread
            state_result = await asyncio.to_thread(playwright_controller.get_element_state, element_id)
            if not state_result.success or not state_result.data:
                logger.warning(f"[mcp_server.py] Failed to get state for element #{element_id} for custom handler: {state_result.message}")
                return json.dumps({
                    "success": False,
                    "message": f"Failed to get element state for #{element_id}: {state_result.message}",
                    "error_type": (state_result.error_type.value if state_result.error_type 
                                   else PlaywrightErrorType.ElementNotFound.value)
                })
            # Ensure state_result.data is InteractiveElementInfo. It should be if PlaywrightController is correct.
            if isinstance(state_result.data, InteractiveElementInfo):
                target_element_info = state_result.data
            else:
                 logger.error(f"[mcp_server.py] Element state for {element_id} is not of type InteractiveElementInfo.")
                 # This case needs to be handled, maybe return error or proceed with None target_element_info

        try:
            # Prepare params for custom handler
            # The CustomActionHandler model defines handler as Callable[[CustomActionHandlerParams], Awaitable[ActionResult]]
            # Our automation_interface is AutomationInterfaceImpl (sync). If handler expects async interface, this mismatch needs resolution.
            # For now, passing the sync interface. The handler must be designed to work with it or use to_thread internally.
            handler_params = CustomActionHandlerParams(
                element=target_element_info, 
                command_args=command_args, 
                automation=automation_interface # This is AutomationInterfaceImpl (Sync)
            )
            result = await custom_handler.handler(handler_params)
            logger.info(f"[mcp_server.py] Custom handler for \"{command_name}\" executed.")
            return json.dumps(result.model_dump(by_alias=True))
        except Exception as e:
            logger.exception(f"[mcp_server.py] Error in custom handler for \"{command_name}\":")
            return json.dumps({
                "success": False,
                "message": f"Error executing custom handler for \"{command_name}\": {str(e)}",
                "error_type": PlaywrightErrorType.ActionFailed.value
            })
    elif (
        command_name in ["click", "type", "select", "check", "uncheck", "choose"] and 
        command_name in custom_action_handler_map and 
        not custom_action_handler_map[command_name].override_core_behavior
    ):
        logger.info(f"[mcp_server.py] Custom handler for core command \"{command_name}\" exists but 'override_core_behavior' is false. Proceeding with core logic.")

    # --- Core Command Logic (if no custom handler or not overridden) ---
    if not element_id and command_name in ["click", "type", "select", "check", "uncheck", "choose"]:
        logger.warning(f"[mcp_server.py] Core command \"{command_name}\" requires an element ID (#elementId) but none was provided.")
        return json.dumps({
            "success": False, 
            "message": f"Core command \"{command_name}\" requires an element ID.", 
            "error_type": PlaywrightErrorType.InvalidInput.value
        })

    # All PlaywrightController methods are synchronous. Wrap them in asyncio.to_thread.
    if command_name == "click" and element_id:
        logger.info(f"[mcp_server.py] Executing core click on #{element_id}")
        result = await asyncio.to_thread(playwright_controller.click, element_id)
    elif command_name == "type" and element_id and command_args:
        text_to_type = command_args[0]
        logger.info(f"[mcp_server.py] Executing core type \"{text_to_type}\" into #{element_id}")
        result = await asyncio.to_thread(playwright_controller.type_text, element_id, text_to_type)
    elif command_name == "select" and element_id and command_args:
        value_to_select = command_args[0]
        logger.info(f"[mcp_server.py] Executing core select \"{value_to_select}\" for #{element_id}")
        result = await asyncio.to_thread(playwright_controller.select_option, element_id, value_to_select)
    elif command_name == "check" and element_id:
        logger.info(f"[mcp_server.py] Executing core check on #{element_id}")
        result = await asyncio.to_thread(playwright_controller.check_element, element_id)
    elif command_name == "uncheck" and element_id:
        logger.info(f"[mcp_server.py] Executing core uncheck on #{element_id}")
        result = await asyncio.to_thread(playwright_controller.uncheck_element, element_id)
    elif command_name == "choose" and element_id: # choose is for radio buttons
        value_to_select = command_args[0] if command_args else element_id
        logger.info(f"[mcp_server.py] Executing core choose on #{element_id} with value \"{value_to_select}\"")
        result = await asyncio.to_thread(playwright_controller.select_radio_button, element_id, value_to_select)
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

    return json.dumps(result.model_dump(by_alias=True))

# --- Server Setup and Lifecycle ---

async def run_mcp_server(options: McpServerOptions) -> None:
    """
    Initializes and starts the FastMCP server with all defined tools.
    Handles graceful shutdown on SIGINT/SIGTERM.
    """
    global mcp_server_instance, playwright_controller, dom_parser, automation_interface # Added dom_parser and automation_interface

    if not options:
        logger.error("[mcp_server.py] McpServerOptions are required to run the server.")
        raise ValueError("McpServerOptions are required.")

    # Initialize components and assign to global variables
    # The initialize_browser_and_dependencies function now handles global assignment internally
    init_pw, init_dp, init_ai = await initialize_browser_and_dependencies(options)

    if not init_pw or not init_dp or not init_ai:
        # The error is already logged by initialize_browser_and_dependencies
        # We use the print statement here for the specific diagnostic requested by the user.
        # print(f"!!! SIMPLE PRINT FROM RUN_MCP_SERVER EXCEPTION HANDLER. ERROR: Initialization failed !!!")
        # traceback.print_exc() # This would print the traceback of *this* scope, which isn't where the original error happened.
        logger.critical("[mcp_server.py] Critical error during initialization. initialize_browser_and_dependencies failed. Server cannot start.")
        return 
    
    # At this point, playwright_controller, dom_parser, and automation_interface globals should be set.

    tools = [
        {
            "name": "get_current_screen_data",
            "description": "Retrieves structured data and interactive elements from the current web page view.",
            "input_schema": None,  # No input parameters for this tool
            "execute": get_current_screen_data_execute # Async function
        },
        {
            "name": "get_current_screen_actions",
            "description": "Retrieves a list of possible actions (like click, type) for interactive elements on the current screen.",
            "input_schema": None,  # No input parameters for this tool
            "execute": get_current_screen_actions_execute # Async function
        },
        {
            "name": "send_command",
            "description": "Sends a command to interact with the web page (e.g., click button, type text). Command format: \"action #elementId arguments...\".",
            "input_schema": SendCommandParams, # Pydantic model for input validation
            "execute": send_command_tool_execute # Async function
        },
    ]

    auth_callback: Optional[Callable[[ClientAuthContext], Awaitable[bool]]] = None
    if options.authenticate_client:
        auth_callback = options.authenticate_client
        logger.info("[mcp_server.py] Client authentication callback is configured.")
    else:
        logger.info("[mcp_server.py] No client authentication callback configured. Server will be open.")

    host = options.host # host already uses Pydantic default if not set
    port = options.port # port already uses Pydantic default if not set

    logger.info(f"[mcp_server.py] Initializing FastMCP server at {host}:{port}...")
    
    try:
        mcp_server_instance = FastMCP(
            host=host,
            port=port,
            title=options.server_name,
            description=options.server_instructions,
            version=options.server_version, 
            tools=tools,
            authenticate_client=auth_callback,
        )
        logger.info("[mcp_server.py] FastMCP server instance created.")
    except Exception as e:
        logger.exception("[mcp_server.py] Failed to create FastMCP server instance")
        if playwright_controller:
            try:
                playwright_controller.close()
            except Exception as pc_close_err:
                logger.exception("[mcp_server.py] Error closing PlaywrightController during FastMCP creation failure")
        return

    logger.info("[mcp_server.py] Starting FastMCP server. Press Ctrl+C to stop.")

    try:
        # Run FastMCP server in a separate thread to avoid event loop conflicts,
        # and specify streamable-http transport with the /sse endpoint.
        http_stream_options = {"endpoint": "/sse"} 
        await asyncio.to_thread(mcp_server_instance.run, transport="streamable-http", transport_options=http_stream_options)
    except KeyboardInterrupt:
        logger.info("[mcp_server.py] KeyboardInterrupt received in run_mcp_server. Initiating shutdown...")
        await graceful_shutdown() # Call graceful_shutdown here
    except Exception as e:
        logger.error(f"[mcp_server.py] FastMCP server exited with error: {e}")
    finally:
        logger.info("[mcp_server.py] FastMCP server has stopped.")
        # Ensure graceful_shutdown is called if not already by signals (e.g., if run() completes normally)
        # However, signal handlers should manage this. If it's a direct error from run(), 
        # we might need to manually trigger parts of graceful_shutdown here, specifically browser closing.
        if playwright_controller and playwright_controller.get_page() and not playwright_controller.get_page().is_closed():
            logger.info("[mcp_server.py] Ensuring Playwright is closed post-server stop.")
            try:
                playwright_controller.close() # This is synchronous
            except Exception as e_close:
                logger.error(f"[mcp_server.py] Error closing playwright_controller in finally block: {e_close}")

async def graceful_shutdown(sig: Optional[signal.Signals] = None) -> None:
    """Handles graceful shutdown of the server and Playwright resources."""
    global mcp_server_instance, playwright_controller 

    if sig:
        logger.info(f"[mcp_server.py] Received signal {sig.name}. Initiating graceful shutdown...")
    else:
        logger.info("[mcp_server.py] Initiating graceful shutdown...")

    # 1. Stop the FastMCP server - We are now assuming FastMCP's run() method
    #    handles its own shutdown upon receiving the termination signal (e.g., SIGINT, SIGTERM)
    #    that also triggers this graceful_shutdown handler. So, no explicit mcp_server_instance.stop() call.
    logger.info("[mcp_server.py] FastMCP server shutdown is expected to be handled internally by FastMCP upon receiving signal.")

    # 2. Close Playwright resources
    if playwright_controller:
        logger.info("[mcp_server.py] Closing Playwright resources...")
        try:
            # playwright_controller.close() is synchronous
            # If graceful_shutdown is called from an event loop handler, 
            # running sync blocking code directly can be an issue.
            # However, typically signal handlers might run it in a way that's okay,
            # or it's the last thing happening.
            # For simplicity now, direct call. Consider to_thread if issues arise.
            await asyncio.to_thread(playwright_controller.close)
            logger.info("[mcp_server.py] Playwright resources closed.")
        except Exception as e:
            logger.error(f"[mcp_server.py] Error closing PlaywrightController: {e}")
    
    logger.info("[mcp_server.py] Graceful shutdown sequence complete.")
    # Optionally, force exit if process hangs, though ideally not needed.
    # sys.exit(0)

# --- Main Entry Point ---

async def main(config_path: Optional[str] = None) -> None:
    """
    Main entry point for the MCP UI Bridge server - primarily for mcp_server.py direct run.
    The mcp_ui_bridge_python.main (Typer app) is the preferred CLI entry point.
    This function loads configuration and runs the server.
    """
    # Remove the temporary print statement from the top of the file.
    # print("!!! EXECUTING THIS MCP_SERVER.PY VERSION - TOP OF FILE !!!") 
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
        logger.info("[mcp_server.py] Main process interrupted. Exiting.")
    except Exception as e:
        logger.exception("[mcp_server.py] Unhandled exception in main")
        if playwright_controller:
            try:
                playwright_controller.close()
            except: pass
