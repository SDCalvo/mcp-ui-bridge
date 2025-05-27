from .models import (
    InteractiveElementInfo,
    ActionResult,
    ClientAuthContext,
    CustomActionHandlerParams,
    CustomAttributeReader,
    CustomActionHandler,
    McpServerOptions,
)
from .mcp_server import run_mcp_server

# Import core components that should be easily accessible
# from .core.playwright_controller import PlaywrightController # Placeholder
# from .core.dom_parser import DomParser # Placeholder

# Import server runner
# from .server import run_mcp_server # Placeholder - depends on where run_mcp_server is defined

__all__ = [
    # Models
    "InteractiveElementInfo",
    "ActionResult",
    "ClientAuthContext",
    "CustomActionHandlerParams",
    "CustomAttributeReader",
    "CustomActionHandler",
    "McpServerOptions",

    # Core components
    # "PlaywrightController",
    # "DomParser",

    # Server runner
    "run_mcp_server", # This will be needed by the external server
]

__version__ = "0.1.0" # Or read from pyproject.toml 