from typing import Optional, List, Dict, Any, Callable, Awaitable, Union, TYPE_CHECKING
from pydantic import BaseModel, Field, HttpUrl

# Correctly import from existing model files
from mcp_ui_bridge_python.models.actions import ActionResult 
from mcp_ui_bridge_python.models.elements import InteractiveElementInfo

# Type checking import for ElementHandle
if TYPE_CHECKING:
    from playwright.async_api import ElementHandle as PlaywrightElementHandle
else:
    PlaywrightElementHandle = Any

# Type Alias for the authentication callback
ClientAuthContextHeaders = Dict[str, Union[str, List[str], None]]

class ClientAuthContext(BaseModel):
    """Contextual information about the client making a request, used for authentication."""
    headers: Dict[str, Any] = Field(default_factory=dict)
    source_ip: Optional[str] = None

    class Config:
        populate_by_name = True

AuthenticateClientCallback = Callable[[ClientAuthContext], Awaitable[bool]]

# Forward declaration for Playwright ElementHandle (as Any for now)
ElementHandle = Any

class CustomAttributeReader(BaseModel):
    """Defines how to read a custom HTML attribute and map it to an element's custom data."""
    attribute_name: str = Field(..., description="The name of the HTML attribute to read (e.g., data-mcp-custom-id).")
    output_key: str = Field(..., description="The key under which the attribute's value will be stored in the element's customData.")
    process_value: Optional[Callable[[Optional[str], Optional[PlaywrightElementHandle]], Union[str, int, float, bool, None]]] = Field(None, description="Optional function to process the raw attribute value before storing it. Receives both the attribute value and the ElementHandle for advanced processing.")

class AutomationInterface(BaseModel):
    """Placeholder model representing the automation interface provided to custom action handlers."""
    pass


class CustomActionHandlerParams(BaseModel):
    """Parameters passed to a custom action handler function."""
    element: Optional[InteractiveElementInfo] = Field(None, description="The target interactive element, if applicable.")
    command_args: List[str] = Field(default_factory=list, description="Arguments extracted from the command string.")
    automation: Any

class CustomActionHandler(BaseModel):
    """Defines a custom command that can be invoked through the MCP server."""
    command_name: str = Field(..., description="The unique name of the command this handler processes (e.g., 'login', 'custom_click').")
    handler: Callable[[CustomActionHandlerParams], Awaitable[ActionResult]] = Field(..., description="The async function to execute for this command.")
    description: Optional[str] = Field(None, description="A brief description of what the custom command does.")
    example_command_string: Optional[str] = Field(None, description="An example of how to invoke this command (e.g., 'login #usernameField myuser mypass').")
    override_core_behavior: bool = Field(False, description="If true, this handler will execute even if the command_name matches a core MCP command (like 'click'). If false and command_name matches a core command, core behavior is preferred unless no element selector is used for the core command.")

class McpServerOptions(BaseModel):
    """Configuration options for the MCP UI Bridge server."""
    target_url: HttpUrl = Field(..., description="The initial URL the browser will navigate to.")
    headless_browser: bool = Field(True, description="Whether to run the browser in headless mode.")
    port: int = Field(7860, description="Port for the MCP server.", ge=1024, le=65535)
    host: str = Field("0.0.0.0", description="Host for the MCP server to bind to.")
    
    server_name: Optional[str] = Field("MCP UI Bridge Server (Python)", description="Name of the MCP server, used in API descriptions.")
    server_version: Optional[str] = Field("0.1.0", description="Version of the MCP server (e.g., 0.1.0), used in API descriptions.", pattern=r"^\d+\.\d+\.\d+$")
    server_instructions: Optional[str] = Field(
        "This server bridges UI interactions to a web page using Playwright, controlled by MCP commands.",
        description="General instructions or description for the root/docs of the MCP server."
    )

    custom_attribute_readers: Optional[List[CustomAttributeReader]] = Field(default_factory=list)
    custom_action_handlers: Optional[List[CustomActionHandler]] = Field(default_factory=list)
    
    authenticate_client: Optional[AuthenticateClientCallback] = Field(None, description="Optional async callback to authenticate clients.")
    
    class Config:
        extra = "forbid"
        arbitrary_types_allowed = True 