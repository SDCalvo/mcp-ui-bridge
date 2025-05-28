# MCP UI Bridge (Python)

**`mcp-ui-bridge-python` is a Python library dedicated to making web applications natively and equally accessible to both human users and Large Language Models (LLMs) through a single, unified development effort.**

It enables the concept of **LLM-Oriented Accessibility**: a paradigm for web interaction where LLMs receive a structured, text-based, and semantically rich understanding of a web application. This is achieved by instrumenting the web application with `data-mcp-*` attributes that the `mcp-ui-bridge-python` library can then parse (using Playwright for browser automation) and expose via a Model Context Protocol (MCP) server.

The core philosophy is **"Code Once, Serve All."** Developers build their rich visual UI for humans, and by adding semantic attributes, the _same_ application becomes fully understandable and operable by LLMs.

This is the Python implementation of the original TypeScript `mcp-ui-bridge` library, providing 100% feature parity with identical data structures and functionality.

## Features

- **Functional MCP Server:** Robust server implementation using `FastMCP`.
- **Playwright Integration:** Manages browser instances and interactions for accessing the target web application.
- **`DomParser`:** Analyzes the live DOM of the target application based on `data-mcp-*` attributes.
- **Core MCP Tools:**
  - `get_current_screen_data`: Fetches structured data and interactive elements from the current web page.
  - `list_actions`: Derives actionable commands and hints based on the parsed elements.
  - `send_command`: Executes actions like `click`, `type`, `select`, `check`, `uncheck`, `choose` (radio), `hover`, `clear` on the web page.
- **Client Authentication Hook:** Supports custom asynchronous authentication logic (`authenticate_client` in `McpServerOptions`) at the connection level, allowing validation of clients (e.g., via API keys in headers) before establishing an MCP session.
- **Custom Attribute Readers:** Extensible system for reading and processing custom `data-mcp-*` attributes.
- **Custom Action Handlers:** Support for custom commands and overriding core behaviors.
- **Configurable:** Supports programmatic options for server settings (target URL, port, headless mode, etc.).
- **Type-Safe:** Full type hints with Pydantic models for robust data validation.

## Installation

```bash
pip install mcp-ui-bridge-python
```

For development or local installation:

```bash
# Clone the repository
git clone https://github.com/your-username/mcp-ui-bridge-python.git
cd mcp-ui-bridge-python

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Install Playwright browsers
python -m playwright install
```

## Basic Usage

Here's a minimal example of how to import and use `run_mcp_server` from `mcp-ui-bridge-python`:

```python
# your_custom_mcp_server.py
import asyncio
import os
from mcp_ui_bridge_python import (
    run_mcp_server,
    McpServerOptions,
    ClientAuthContext,
)

async def start_my_mcp_bridge():
    options = McpServerOptions(
        target_url=os.getenv("MY_APP_URL", "http://localhost:3000"),  # URL of your web application
        port=int(os.getenv("MY_MCP_BRIDGE_PORT", "8090")),
        headless_browser=os.getenv("HEADLESS", "false").lower() == "true",
        server_name="My Custom MCP Bridge",
        server_version="1.0.0",
        server_instructions="This bridge connects to My Awesome App, providing tools to interact with its UI.",
        # Optional: Implement custom client authentication
        authenticate_client=authenticate_client_dummy,
    )

    try:
        await run_mcp_server(options)
        print(f"My Custom MCP Bridge started on port {options.port}, targeting {options.target_url}")
    except Exception as e:
        print(f"Failed to start My Custom MCP Bridge: {e}")
        raise

async def authenticate_client_dummy(context: ClientAuthContext) -> bool:
    """Custom client authentication function."""
    print(f"Authentication attempt from IP: {context.source_ip}, Headers: {context.headers}")

    api_key = context.headers.get("x-my-app-api-key")  # Example: check for an API key
    expected_key = os.getenv("MY_EXPECTED_API_KEY")

    if api_key and api_key == expected_key:
        print("Client authenticated successfully.")
        return True

    print("Client authentication failed: API key missing or incorrect.")
    return False

if __name__ == "__main__":
    asyncio.run(start_my_mcp_bridge())
```

## Configuration (`McpServerOptions`)

The `run_mcp_server` function takes an `McpServerOptions` object. Key options include:

- `target_url` (str, required): The URL of the web application the MCP server will control.
- `port` (int, optional): Port for the MCP server. Defaults to `8080` if not set by the `MCP_PORT` environment variable or this option directly.
- `headless_browser` (bool, optional): Whether to run Playwright in headless mode. Defaults to `False` (browser window is visible).
- `server_name` (str, optional): A descriptive name for your MCP server (e.g., "MyWebApp MCP Bridge").
- `server_version` (str, optional): Version string for your MCP server (e.g., "1.0.3").
- `server_instructions` (str, optional): Default instructions provided to an LLM client on how to use this MCP server or interact with the target application.
- `authenticate_client` (function, optional): An asynchronous function `(context: ClientAuthContext) -> bool`.
  - The `ClientAuthContext` object provides:
    - `headers: Dict[str, Union[str, List[str], None]]`: Incoming HTTP headers from the MCP client.
    - `source_ip: Optional[str]`: Source IP address of the MCP client.
  - Your function should return `True` to allow the connection or `False` to deny it (which will result in a 401 Unauthorized response to the client).
  - This allows you to implement custom security logic, such as validating API keys, session tokens, or IP whitelists.
- `custom_attribute_readers` (`List[CustomAttributeReader]`, optional): Allows you to define how additional custom `data-mcp-*` attributes should be read from your HTML elements and processed.
- `custom_action_handlers` (`List[CustomActionHandler]`, optional): Allows you to define custom commands or override core behaviors.

## Custom Attribute Readers

The `custom_attribute_readers` option allows you to extract and process custom `data-mcp-*` attributes from your HTML elements.

Each `CustomAttributeReader` object should specify:

- `attribute_name` (str, required): The full name of the custom data attribute (e.g., `"data-mcp-priority"`).
- `output_key` (str, required): The key under which the extracted value will be stored in the `customData` field of an `InteractiveElementInfo` object.
- `process_value` (function, optional): `(attribute_value: Optional[str], element_handle: Optional[Any] = None) -> Any`
  - An optional function to process the raw attribute string value.
  - `attribute_value`: The raw string value of the attribute (or `None` if not present).
  - `element_handle`: The Playwright `ElementHandle` for more complex processing if needed.
  - Returns the processed value to be stored.

**Example: Using `custom_attribute_readers`**

```python
from mcp_ui_bridge_python import CustomAttributeReader, McpServerOptions
from typing import Optional, Any, Union

def process_priority_value(value: Optional[str], element_handle: Optional[Any] = None) -> Union[int, str, None]:
    """Convert priority to integer if possible, otherwise keep as string."""
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return value  # Keep as string if not a valid number

my_custom_readers = [
    CustomAttributeReader(
        attribute_name="data-mcp-widget-type",
        output_key="widgetType",  # Will appear as customData["widgetType"]
    ),
    CustomAttributeReader(
        attribute_name="data-mcp-item-status",
        output_key="status",  # Will appear as customData["status"]
        process_value=lambda value: "unknown" if value is None else value.upper(),
    ),
    CustomAttributeReader(
        attribute_name="data-mcp-priority",
        output_key="priority",
        process_value=process_priority_value,
    ),
]

options = McpServerOptions(
    target_url="http://localhost:3000",
    # ... other options
    custom_attribute_readers=my_custom_readers,
)
```

**HTML Example:**

```html
<button
  data-mcp-interactive-element="action-button-1"
  data-mcp-widget-type="special-action-button"
  data-mcp-item-status="pending"
  data-mcp-priority="5"
>
  Process Item
</button>
```

**Expected `customData` in `InteractiveElementInfo`:**

```json
{
  "widgetType": "special-action-button",
  "status": "PENDING",
  "priority": 5
}
```

## Custom Action Handlers

The `custom_action_handlers` option allows you to extend or modify the command processing capabilities of the MCP server. You can introduce entirely new commands or change how existing core commands behave.

Each handler is defined as a `CustomActionHandler` object:

```python
from mcp_ui_bridge_python import (
    CustomActionHandler,
    CustomActionHandlerParams,
    ActionResult,
    InteractiveElementInfo,
    AutomationInterface,
)

async def my_custom_handler(params: CustomActionHandlerParams) -> ActionResult:
    """Custom command handler."""
    # Access element data
    element = params.element
    command_args = params.command_args
    automation = params.automation

    # Your custom logic here
    return ActionResult(
        success=True,
        message=f"Custom action executed on {element.id}",
        data={"custom": "result"}
    )

custom_handlers = [
    CustomActionHandler(
        command_name="my-custom-command",
        handler=my_custom_handler,
    ),
    # Override core behavior
    CustomActionHandler(
        command_name="click",
        override_core_behavior=True,
        handler=custom_click_override,
    ),
]
```

**Key interfaces:**

- `CustomActionHandlerParams`:

  - `element: InteractiveElementInfo`: Full details of the targeted element
  - `command_args: List[str]`: Arguments from the command string after elementId
  - `automation: AutomationInterface`: Safe methods to interact with the browser

- `AutomationInterface` provides methods like:
  - `automation.click(element_id: str) -> ActionResult`
  - `automation.type(element_id: str, text: str) -> ActionResult`
  - `automation.select_option(element_id: str, value: str) -> ActionResult`
  - `automation.check_element(element_id: str) -> ActionResult`
  - `automation.uncheck_element(element_id: str) -> ActionResult`
  - `automation.hover_element(element_id: str) -> ActionResult`
  - `automation.clear_element(element_id: str) -> ActionResult`
  - `automation.get_element_state(element_id: str) -> ActionResult`

**Example 1: Adding a New Custom Command**

```python
async def summarize_text_handler(params: CustomActionHandlerParams) -> ActionResult:
    """Custom command to summarize text content of an element."""
    print(f"Custom 'summarize-text' called for element: {params.element.id}")

    text_content = params.element.currentValue
    if not text_content:
        # Try to get current state
        state_result = await params.automation.get_element_state(params.element.id)
        if state_result.success and state_result.data:
            text_content = state_result.data.get("currentValue")

    if not text_content:
        return ActionResult(
            success=False,
            message="No text content found to summarize.",
        )

    # Simple truncation for demo (in reality, you might call an LLM)
    summary = text_content[:47] + "..." if len(text_content) > 50 else text_content

    return ActionResult(
        success=True,
        message=f"Summary for {params.element.id}: {summary}",
        data={"summary": summary, "originalLength": len(text_content)},
    )

my_custom_handlers = [
    CustomActionHandler(
        command_name="summarize-text",
        handler=summarize_text_handler,
    ),
]
```

**Example 2: Overriding Core Click Behavior**

```python
async def custom_click_override(params: CustomActionHandlerParams) -> ActionResult:
    """Custom click handler that adds logging and confirmation for critical buttons."""
    if params.element.elementType == "critical-button":
        print(f"[AUDIT] Critical button {params.element.id} about to be clicked.")
        # Add custom logic here (logging, confirmation, etc.)

    # Perform the original click action
    result = await params.automation.click(params.element.id)

    if result.success and params.element.elementType == "critical-button":
        result.message = "✨ Critical button clicked via override! " + (result.message or "")

    return result

override_handler = CustomActionHandler(
    command_name="click",
    override_core_behavior=True,
    handler=custom_click_override,
)
```

## How It Works

1. **Semantic Instrumentation (by You)**: You annotate your HTML elements with specific `data-mcp-*` attributes that provide semantic meaning about your UI's structure, interactive elements, and their purpose.

2. **`DomParser` (within `mcp-ui-bridge-python`)**: When the MCP server is active and connected to your `target_url`, its internal `DomParser` module uses Playwright to access the live DOM of your web application and extract structured data.

3. **Structured Data Extraction**: The `DomParser` extracts a structured JSON representation of the page, including interactive elements, display data, and their associated semantic information.

4. **`PlaywrightController` (within `mcp-ui-bridge-python`)**: When an LLM client sends a command, the server translates the MCP command into Playwright actions and executes them on the live web page.

5. **MCP Server & Tools**: The server exposes standardized MCP tools to the LLM client:
   - `get_current_screen_data`: Allows the LLM to "see" the current state of the web page
   - `list_actions`: Provides suggested actions based on currently visible elements
   - `send_command`: Enables the LLM to execute interactions on the page

## Instrumenting Your Frontend with `data-mcp-*` Attributes

To make your web application understandable by `mcp-ui-bridge-python`, you need to add `data-mcp-*` attributes to your HTML elements. These attributes provide the semantic information that the bridge uses to interpret your UI.

**Key Attributes:**

- `data-mcp-interactive-element="unique-id"`: Marks an element as interactive with a unique ID.
- `data-mcp-element-type="<type>"`: Specifies the element type (`button`, `input-text`, `select`, `input-checkbox`, `input-radio`, `a`, etc.).
- `data-mcp-element-label="<label>"`: Human-readable label for the element.
- `data-mcp-purpose="<description>"`: Detailed description of what the element does.
- `data-mcp-value-source-prop="<prop>"`: For inputs, specifies the property holding the current value (typically `value`).
- `data-mcp-checked-prop="<prop>"`: For checkboxes/radios, specifies the property indicating checked state (typically `checked`).
- `data-mcp-radio-group-name="<name>"`: For radio buttons, must match the HTML `name` attribute.
- `data-mcp-region="<region-id>"`: Defines logical sections or containers.
- `data-mcp-display-item-text`: Marks elements whose text content should be captured.
- `data-mcp-display-item-id="<unique-id>"`: Unique ID for display items.
- `data-mcp-navigates-to="<url>"`: Indicates navigation destinations.
- `data-mcp-triggers-loading="true"`: Indicates elements that trigger loading states.

**Example HTML Snippets:**

**Simple Button:**

```html
<button
  data-mcp-interactive-element="submit-button"
  data-mcp-element-type="button"
  data-mcp-element-label="Submit Form"
  data-mcp-purpose="Submits the current form data."
>
  Submit
</button>
```

**Text Input:**

```html
<input
  type="text"
  data-mcp-interactive-element="username-field"
  data-mcp-element-type="input-text"
  data-mcp-element-label="Username"
  data-mcp-purpose="Enter your username."
  data-mcp-value-source-prop="value"
/>
```

**Checkbox:**

```html
<input
  type="checkbox"
  data-mcp-interactive-element="terms-checkbox"
  data-mcp-element-type="input-checkbox"
  data-mcp-element-label="Agree to Terms"
  data-mcp-purpose="Confirm agreement to terms and conditions."
  data-mcp-checked-prop="checked"
/>
<label>I agree to the terms and conditions</label>
```

**Select Dropdown:**

```html
<select
  data-mcp-interactive-element="country-selector"
  data-mcp-element-type="select"
  data-mcp-element-label="Country Selector"
  data-mcp-purpose="Select your country of residence."
  data-mcp-value-source-prop="value"
>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
  <option value="gb">United Kingdom</option>
</select>
```

**Radio Button Group:**

```html
<div role="radiogroup">
  <span>Choose Payment Method:</span>
  <div>
    <input
      type="radio"
      name="paymentMethod"
      value="credit_card"
      data-mcp-interactive-element="payment-type-cc"
      data-mcp-element-type="input-radio"
      data-mcp-element-label="Credit Card"
      data-mcp-radio-group-name="paymentMethod"
      data-mcp-checked-prop="checked"
    />
    <label>Credit Card</label>
  </div>
  <div>
    <input
      type="radio"
      name="paymentMethod"
      value="paypal"
      data-mcp-interactive-element="payment-type-paypal"
      data-mcp-element-type="input-radio"
      data-mcp-element-label="PayPal"
      data-mcp-radio-group-name="paymentMethod"
      data-mcp-checked-prop="checked"
    />
    <label>PayPal</label>
  </div>
</div>
```

**Display Container/Region:**

```html
<div
  data-mcp-region="user-profile-card"
  data-mcp-purpose="Displays user profile information."
>
  <h2 data-mcp-display-item-text data-mcp-display-item-id="user-name-display">
    John Doe
  </h2>
  <p data-mcp-display-item-text data-mcp-display-item-id="user-email-display">
    john@example.com
  </p>
  <button
    data-mcp-interactive-element="edit-profile-button"
    data-mcp-element-type="button"
    data-mcp-element-label="Edit Profile"
    data-mcp-purpose="Navigate to profile editing page."
    data-mcp-navigates-to="/profile/edit"
  >
    Edit Profile
  </button>
</div>
```

## Development

If you want to contribute to the `mcp-ui-bridge-python` library:

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/mcp-ui-bridge-python.git
   cd mcp-ui-bridge-python
   ```

2. Set up development environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -e ".[dev]"
   ```

3. Install Playwright browsers:

   ```bash
   python -m playwright install
   ```

4. Run tests:

   ```bash
   pytest
   ```

5. Format code:

   ```bash
   black .
   isort .
   ```

6. Type checking:
   ```bash
   mypy mcp_ui_bridge_python
   ```

## API Reference

### Core Classes

- `McpServerOptions`: Configuration options for the MCP server
- `CustomAttributeReader`: Configuration for custom attribute extraction
- `CustomActionHandler`: Configuration for custom command handlers
- `InteractiveElementInfo`: Data model for interactive elements
- `ActionResult`: Result model for action execution
- `ClientAuthContext`: Context for client authentication

### Core Functions

- `run_mcp_server(options: McpServerOptions) -> None`: Main function to start the MCP server

## Comparison with TypeScript Version

This Python implementation provides 100% feature parity with the original TypeScript version:

- **Identical Data Structures**: All JSON responses match exactly between versions
- **Same MCP Tools**: `get_current_screen_data`, `list_actions`, `send_command`
- **Compatible Attributes**: Same `data-mcp-*` attribute system
- **Custom Extensions**: Both support custom attribute readers and action handlers
- **Authentication**: Same client authentication capabilities

The main differences are:

- Python syntax and conventions instead of TypeScript
- Pydantic models instead of TypeScript interfaces
- Python async/await patterns
- pip/PyPI distribution instead of npm

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.
