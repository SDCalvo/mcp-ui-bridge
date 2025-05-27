# Placeholder for data-mcp-* attribute constants
# e.g., DATA_MCP_INTERACTIVE_ELEMENT = "data-mcp-interactive-element" 

class DataAttributes:
    INTERACTIVE_ELEMENT = "data-mcp-interactive-element"
    DISPLAY_CONTAINER = "data-mcp-display-container"
    DISPLAY_ITEM_TEXT = "data-mcp-display-item-text"
    ELEMENT_LABEL = "data-mcp-element-label"
    ELEMENT_TYPE = "data-mcp-element-type"
    ELEMENT_STATE = "data-mcp-element-state"  # Corresponds to data-mcp-custom-state in TS controller, but data-mcp-element-state in TS attributes.ts
    NAVIGATES_TO = "data-mcp-navigates-to"
    VALUE = "data-mcp-value"
    DISPLAY_ITEM_ID = "data-mcp-display-item-id"
    PURPOSE = "data-mcp-purpose"
    GROUP = "data-mcp-group"
    CONTROLS = "data-mcp-controls"
    UPDATES_CONTAINER = "data-mcp-updates-container"
    REGION = "data-mcp-region"
    DISABLED_STATE = "data-mcp-disabled"
    READONLY_STATE = "data-mcp-readonly"
    LOADING_INDICATOR_FOR = "data-mcp-loading-indicator-for"
    STATUS_MESSAGE_CONTAINER = "data-mcp-status-message-container"
    FIELD_NAME = "data-mcp-field"

    # Note: In playwright_controller.py, ELEMENT_STATE was "data-mcp-custom-state"
    # based on the TS controller. The attributes.ts file uses "data-mcp-element-state".
    # We'll stick to "data-mcp-element-state" here as per attributes.ts,
    # and ensure consistency when these are used.
    # For now, the Python PlaywrightController uses "data-mcp-custom-state" for its `customState` field.
    # This might need to be reconciled. For now, I will keep the Python PlaywrightController as is. 