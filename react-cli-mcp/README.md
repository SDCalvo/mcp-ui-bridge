# `mcp-ui-bridge`

**`mcp-ui-bridge` is a library dedicated to making web applications natively and equally accessible to both human users and Large Language Models (LLMs) through a single, unified development effort.**

It enables the concept of **LLM-Oriented Accessibility**: a paradigm for web interaction where LLMs receive a structured, text-based, and semantically rich understanding of a web application. This is achieved by instrumenting the web application with `data-mcp-*` attributes that the `mcp-ui-bridge` library can then parse (using Playwright for browser automation) and expose via a Model Context Protocol (MCP) server.

The core philosophy is **"Code Once, Serve All."** Developers build their rich visual UI for humans, and by adding semantic attributes, the _same_ application becomes fully understandable and operable by LLMs.

This `README.md` is for the `mcp-ui-bridge` library itself, found within the `/react-cli-mcp` directory of the main [mcp-ui-bridge project repository](https://github.com/SDCalvo/mcp-ui-bridge). For an overview of the entire project structure and how to run the example `mcp-external-server`, please see the [main project README](https://github.com/SDCalvo/mcp-ui-bridge/blob/main/README.md).

## Features

- **Functional MCP Server:** Robust server implementation using `FastMCP`.
- **Playwright Integration:** Manages browser instances and interactions for accessing the target web application.
- **`DomParser`:** Analyzes the live DOM of the target application based on `data-mcp-*` attributes.
- **Core MCP Tools:**
  - `get_current_screen_data`: Fetches structured data and interactive elements from the current web page.
  - `get_current_screen_actions`: Derives actionable commands and hints based on the parsed elements.
  - `send_command`: Executes actions like `click`, `type`, `select`, `check`, `uncheck`, `choose` (radio), `hover`, `clear` on the web page.
- **Client Authentication Hook:** Supports custom asynchronous authentication logic (`authenticateClient` in `McpServerOptions`) at the connection level, allowing validation of clients (e.g., via API keys in headers) before establishing an MCP session.
- **Configurable:** Supports programmatic options for server settings (target URL, port, headless mode, etc.).
- **ES Module Compatible.**

## Installation

```bash
npm install mcp-ui-bridge
```

If you are developing locally or integrating from the monorepo source, you might use `npm link` or specify a file path in your consuming project's `package.json`:

```json
"dependencies": {
  "mcp-ui-bridge": "file:../path/to/react-cli-mcp"
}
```

_(Adjust the file path as necessary if the `react-cli-mcp` directory is the source of the `mcp-ui-bridge` package)._

## Basic Usage

Here's a minimal example of how to import and use `runMcpServer` from `mcp-ui-bridge`:

```typescript
// your-custom-mcp-server.ts
import {
  runMcpServer,
  McpServerOptions,
  ClientAuthContext,
} from "mcp-ui-bridge";

async function startMyMcpBridge() {
  const options: McpServerOptions = {
    targetUrl: process.env.MY_APP_URL || "http://localhost:3000", // URL of your web application
    port: Number(process.env.MY_MCP_BRIDGE_PORT) || 8090,
    headlessBrowser: process.env.HEADLESS !== "false",
    serverName: "My Custom MCP Bridge",
    serverVersion: "1.0.0",
    serverInstructions:
      "This bridge connects to My Awesome App, providing tools to interact with its UI.",
    // Optional: Implement custom client authentication
    authenticateClient: async (
      context: ClientAuthContext
    ): Promise<boolean> => {
      console.log(
        `Authentication attempt from IP: ${
          context.sourceIp
        }, Headers: ${JSON.stringify(context.headers)}`
      );
      const apiKey = context.headers["x-my-app-api-key"]; // Example: check for an API key
      if (apiKey && apiKey === process.env.MY_EXPECTED_API_KEY) {
        console.log("Client authenticated successfully.");
        return true;
      }
      console.log(
        "Client authentication failed: API key missing or incorrect."
      );
      return false;
    },
  };

  try {
    await runMcpServer(options);
    console.log(
      `My Custom MCP Bridge started on port ${options.port}, targeting ${options.targetUrl}`
    );
  } catch (error) {
    console.error("Failed to start My Custom MCP Bridge:", error);
    process.exit(1);
  }
}

startMyMcpBridge();
```

## Configuration (`McpServerOptions`)

The `runMcpServer` function takes an `McpServerOptions` object. Key options include:

- `targetUrl` (string, required): The URL of the web application the MCP server will control.
- `port` (number, optional): Port for the MCP server. Defaults to `8080` if not set by the `MCP_PORT` environment variable or this option directly.
- `headlessBrowser` (boolean, optional): Whether to run Playwright in headless mode. Defaults to `false` (browser window is visible).
- `ssePath` (string, optional): The path for the Server-Sent Events (SSE) endpoint for MCP communication. Defaults to `/sse`.
- `serverName` (string, optional): A descriptive name for your MCP server (e.g., "MyWebApp MCP Bridge").
- `serverVersion` (string, optional): Version string for your MCP server (e.g., "1.0.3").
- `serverInstructions` (string, optional): Default instructions provided to an LLM client on how to use this MCP server or interact with the target application.
- `authenticateClient` (function, optional): An asynchronous function `(context: ClientAuthContext) => Promise<boolean>`.
  - The `ClientAuthContext` object provides:
    - `headers: Record<string, string | string[] | undefined>`: Incoming HTTP headers from the MCP client.
    - `sourceIp: string | undefined`: Source IP address of the MCP client.
  - Your function should return `true` to allow the connection or `false` to deny it (which will result in a 401 Unauthorized response to the client).
  - This allows you to implement custom security logic, such as validating API keys, session tokens, or IP whitelists.
- `customAttributeReaders` (`CustomAttributeReader[]`, optional): Allows you to define how additional custom `data-mcp-*` attributes should be read from your HTML elements and processed.
  - Each `CustomAttributeReader` object in the array should specify:
    - `attributeName` (string, required): The full name of the custom data attribute (e.g., `"data-mcp-priority"`).
    - `outputKey` (string, required): The key under which the extracted value will be stored in the `customData` field of an `InteractiveElementInfo` object.
    - `processValue` (function, optional): `(attributeValue: string | null, elementHandle?: import("playwright").ElementHandle) => any;`
      - An optional function to process the raw attribute string value. If not provided, the raw string value (or `undefined` if the attribute is not found on an element) will be used.
      - `attributeValue`: The raw string value of the attribute (or `null` if not present).
      - `elementHandle`: The Playwright `ElementHandle` for more complex processing if needed (e.g., inspecting other properties or child elements).
      - Returns the processed value to be stored.
  - When `customAttributeReaders` are provided, the `InteractiveElementInfo` objects returned by `get_current_screen_data` (and used internally) will include a `customData: Record<string, any>` field containing the data extracted by your readers.

**Example: Using `customAttributeReaders`**

Let's say you want to extract a `data-mcp-widget-type` and a `data-mcp-item-status` from your elements.

_In your server setup (e.g., `your-custom-mcp-server.ts`):_

```typescript
import { McpServerOptions, CustomAttributeReader } from "mcp-ui-bridge";

const myCustomReaders: CustomAttributeReader[] = [
  {
    attributeName: "data-mcp-widget-type",
    outputKey: "widgetType", // Will appear as customData.widgetType
  },
  {
    attributeName: "data-mcp-item-status",
    outputKey: "status", // Will appear as customData.status
    processValue: (value: string | null) => {
      if (value === null) return "unknown"; // Default if attribute not present
      return value.toUpperCase(); // Example processing: convert to uppercase
    },
  },
];

const options: McpServerOptions = {
  targetUrl: "http://localhost:3000",
  // ... other options
  customAttributeReaders: myCustomReaders,
};
// ... rest of your server setup with runMcpServer(options)
```

_In your HTML/JSX:_

```html
<button
  data-mcp-interactive-element="action-button-1"
  data-mcp-widget-type="special-action-button"
  data-mcp-item-status="pending"
>
  Process Item
</button>

<div
  data-mcp-interactive-element="info-display-1"
  data-mcp-widget-type="info-panel"
>
  Some information
</div>
```

_Expected `customData` in `InteractiveElementInfo` (for `action-button-1`):_

```json
{
  "widgetType": "special-action-button",
  "status": "PENDING"
}
```

_Expected `customData` in `InteractiveElementInfo` (for `info-display-1`):_

```json
{
  "widgetType": "info-panel",
  "status": "UNKNOWN"
}
```

## Custom Action Handlers (`customActionHandlers`)

The `customActionHandlers` option in `McpServerOptions` allows you to extend or modify the command processing capabilities of the `mcp-ui-bridge` server. You can introduce entirely new commands or change how existing core commands (like `click`, `type`, etc.) behave.

Each handler is defined as a `CustomActionHandler` object:

```typescript
import {
  McpServerOptions,
  CustomActionHandler,
  CustomActionHandlerParams,
  ActionResult,
  InteractiveElementInfo,
  AutomationInterface,
} from "mcp-ui-bridge";

export interface CustomActionHandler {
  commandName: string; // The first word of the command (e.g., "click", "my-custom-verb")
  handler: (params: CustomActionHandlerParams) => Promise<ActionResult>; // Your function
  overrideCoreBehavior?: boolean; // Default: false. If true and commandName matches a core command, this handler is used instead.
}

export interface CustomActionHandlerParams {
  element: InteractiveElementInfo; // Full details of the targeted element (if command includes #elementId)
  commandArgs: string[]; // Arguments from the command string after elementId
  automation: AutomationInterface; // Safe methods to interact with the browser
}

// The AutomationInterface provides methods like:
// automation.click(elementId): Promise<ActionResult>
// automation.type(elementId, text): Promise<ActionResult>
// automation.getElementState(elementId): Promise<ActionResult<Partial<InteractiveElementInfo> | null>>
// ...and others (see AutomationInterface definition in types/index.ts for full list)

// Your custom handler will receive an `automation` object of type `AutomationInterface`.
// This interface provides the following curated and safe methods to interact with the browser:
//
// | Method                 | Description                                                                                    | Parameters                                     | Returns                     |
// |------------------------|------------------------------------------------------------------------------------------------|------------------------------------------------|-----------------------------|
// | `click`                | Clicks an element.                                                                             | `elementId: string`, `timeout?: number`          | `Promise<ActionResult>`     |
// | `type`                 | Types text into an element.                                                                    | `elementId: string`, `text: string`, `timeout?: number` | `Promise<ActionResult>`     |
// | `selectOption`         | Selects an option within a `<select>` element.                                                 | `elementId: string`, `value: string`, `timeout?: number` | `Promise<ActionResult>`     |
// | `checkElement`         | Checks a checkbox or radio button.                                                             | `elementId: string`, `timeout?: number`          | `Promise<ActionResult>`     |
// | `uncheckElement`       | Unchecks a checkbox.                                                                           | `elementId: string`, `timeout?: number`          | `Promise<ActionResult>`     |
// | `selectRadioButton`    | Selects a radio button within a group (identified by one of its members' `elementId`).        | `radioButtonIdInGroup: string`, `valueToSelect: string`, `timeout?: number` | `Promise<ActionResult>`     |
// | `hoverElement`         | Hovers over an element.                                                                        | `elementId: string`, `timeout?: number`          | `Promise<ActionResult>`     |
// | `clearElement`         | Clears the content of an input element.                                                        | `elementId: string`, `timeout?: number`          | `Promise<ActionResult>`     |
// | `getElementState`      | Retrieves the state of a specific interactive element, including its custom data.              | `elementId: string`, `timeout?: number`          | `Promise<ActionResult<Partial<InteractiveElementInfo> | null>>` |
//
// More automation methods may be added to `AutomationInterface` in the future as needed.
// All methods return a `Promise<ActionResult>` consistent with other library operations.
```

**How it Works:**
When the `send_command` tool receives a command string:

1. It parses the command into `commandName`, `elementId` (if present, e.g., `#my-button`), and `commandArgs`.
2. If a `CustomActionHandler` is registered with a matching `commandName`:
   - The server fetches the `InteractiveElementInfo` for the specified `elementId`.
   - It then invokes your `handler` function with the `CustomActionHandlerParams`.
   - Your handler is responsible for performing the action and returning an `ActionResult`.
3. If `overrideCoreBehavior` is `true` for a command name that matches a core command (e.g., "click"), your custom handler will execute _instead_ of the default behavior.
4. If no custom handler is found, or if one exists for a core command name but `overrideCoreBehavior` is `false`, the server attempts to execute its built-in logic for core commands.
5. If the command is not recognized as a custom or core command, an error is returned.

**Example 1: Adding a New Custom Command `summarize-text #elementId`**

_In your server setup (e.g., `your-mcp-server.ts`):_

```typescript
const myCustomHandlers: CustomActionHandler[] = [
  {
    commandName: "summarize-text",
    handler: async (
      params: CustomActionHandlerParams
    ): Promise<ActionResult> => {
      console.log(
        `Custom 'summarize-text' called for element: ${params.element.id}`
      );
      const textContent =
        params.element.currentValue ||
        (await params.automation.getElementState(params.element.id)).data
          ?.currentValue;

      if (textContent === undefined || textContent === null) {
        return {
          success: false,
          message: "No text content found to summarize.",
        };
      }

      // In a real scenario, you might call an LLM here to summarize.
      // For this example, we'll just truncate and add a note.
      const summary =
        textContent.length > 50
          ? textContent.substring(0, 47) + "..."
          : textContent;

      return {
        success: true,
        message: `Summary for ${params.element.id}: ${summary}`,
        data: { summary, originalLength: textContent.length },
      };
    },
  },
];

const options: McpServerOptions = {
  // ... other options
  customActionHandlers: myCustomHandlers,
};
// runMcpServer(options);
```

_Command LLM might send:_ `send_command summarize-text #my-text-area`

**Example 2: Overriding the Core `click` Command for a Specific Element Type**

Let's say you want to add extra logging or a confirmation step before any element with `elementType: "critical-button"` is clicked.

_In your server setup:_

```typescript
const criticalClickOverride: CustomActionHandler = {
  commandName: "click",
  overrideCoreBehavior: true, // This is key to replace the default click
  handler: async (params: CustomActionHandlerParams): Promise<ActionResult> => {
    if (params.element.elementType === "critical-button") {
      console.log(
        `[AUDIT] Critical button ${params.element.id} about to be clicked.`
      );
      // You could add a delay, ask for a simulated confirmation, etc.
      // For now, just log and proceed with the original click.
      const result = await params.automation.click(params.element.id);
      if (result.success) {
        result.message =
          "Critical button clicked successfully via override! " +
          (result.message || "");
      }
      return result;
    } else {
      // Not a critical button, so perform the standard click action directly.
      // This ensures other clicks behave normally if this handler is the only one for "click".
      console.log(
        `Standard click on ${params.element.id} via override passthrough.`
      );
      return params.automation.click(params.element.id);
    }
  },
};

const options: McpServerOptions = {
  // ... other options
  customActionHandlers: [criticalClickOverride],
};
// runMcpServer(options);
```

This allows for fine-grained control over interactions, enabling complex workflows or tailored behaviors for specific UI elements directly from your MCP server logic.

## How It Works

1.  **Semantic Instrumentation (by You)**: You, as the developer of a web application, annotate your HTML elements with specific `data-mcp-*` attributes (detailed below). These attributes provide semantic meaning about your UI's structure, interactive elements, and their purpose.
2.  **`DomParser` (within `mcp-ui-bridge`)**: When the MCP server (created by `runMcpServer`) is active and connected to your `targetUrl`, its internal `DomParser` module uses Playwright to access the live DOM of your web application. It scans for the `data-mcp-*` attributes you've added.
3.  **Structured Data Extraction**: The `DomParser` extracts a structured JSON representation of the page, including its current URL, identified interactive elements (buttons, inputs, links, custom elements), display data (from containers and regions), and their associated semantic information (labels, purposes, values).
4.  **`PlaywrightController` (within `mcp-ui-bridge`)**: When an LLM client sends a command (e.g., `click #buttonId`, `type #inputId "text"`) to the MCP server, the server uses its internal `PlaywrightController` module. This module translates the MCP command into Playwright actions and executes them reliably on the live web page.
5.  **MCP Server & Tools**: The server, powered by `FastMCP`, exposes standardized MCP tools to the LLM client:
    - `get_current_screen_data`: Allows the LLM to "see" the current state of the web page as the structured JSON data extracted by `DomParser`.
    - `get_current_screen_actions`: Provides the LLM with a list of suggested actions and command hints based on the currently visible and enabled interactive elements.
    - `send_command`: Enables the LLM to execute the desired interaction on the page.

## Instrumenting Your Frontend with `data-mcp-*` Attributes

To make your web application understandable and operable by `mcp-ui-bridge`, you need to add `data-mcp-*` attributes to your HTML elements. These attributes provide the semantic information that the bridge uses to interpret your UI and suggest/execute actions.

**Key Attributes:**

- `data-mcp-interactive-element="unique-id"`: Marks an element as interactive. The ID should be unique within the currently rendered view and is used by the LLM to target actions (e.g., `click #unique-id`).
- `data-mcp-element-type="<type>"`: Specifies the type of interactive element. Supported types include:
  - `button`
  - `text_input`
  - `select`
  - `checkbox`
  - `radio`
  - `link` (though often handled implicitly by its nature)
  - `form` (can be used to group related inputs)
- `data-mcp-element-label="<label>"`: A concise, human-readable label for the element. This is crucial for the LLM to understand what the element represents (e.g., "Username", "Submit Application", "Next Page"). It's often derived from visible text near the element, an `aria-label`, or a placeholder.
- `data-mcp-purpose="<description>"`: A more detailed description of what the element does or what it's for. This provides additional context to the LLM. (e.g., "Enters the user's chosen username.", "Finalizes the order and proceeds to payment.").
- `data-mcp-value-source-prop="<prop>"`: For input elements (`text_input`, `select`), this specifies the JavaScript property on the DOM element that holds its current value. Typically `value`. The bridge will attempt to read this property to report the current state.
- `data-mcp-checked-prop="<prop>"`: For `checkbox` and `radio` elements, this specifies the JavaScript property indicating its checked state. Typically `checked`.
- `data-mcp-radio-group-name="<name>"`: **Crucial for radio buttons.** This attribute must match the HTML `name` attribute of the radio button group. It allows the bridge to correctly identify and interact with radio buttons as part of a group (e.g., `choose #radio_id "value"` where `#radio_id` is one of the radio buttons in the group).
- `data-mcp-options-source="<strategy>"`: For `select` elements, indicates how options should be discovered. Currently, the primary strategy involves looking for child `<option>` tags. Values from these options are extracted. Option labels can be specified with `data-mcp-element-label` on the `<option>` tags themselves.
- `data-mcp-region="<region-id>"`: Defines a logical section, container, or group of elements on the page (e.g., "user-profile-card", "search-filters"). This helps in structuring the information presented to the LLM. The `purpose` attribute can also be applied to regions.
- `data-mcp-display-item-text`: Marks an element whose `innerText` or `textContent` should be captured as a piece of displayable information for the LLM.
- `data-mcp-display-item-id="<unique-id>"`: A unique ID for a specific piece of text marked with `data-mcp-display-item-text`. This allows the LLM to reference or query specific text content.
- `data-mcp-navigates-to="<url_or_identifier>"`: (Optional) Indicates that interacting with this element (e.g., a link or button) will cause a navigation. The value can be a URL or a conceptual identifier for the destination page/view.
- `data-mcp-triggers-loading="true"`: (Optional) Indicates that interacting with this element may trigger an asynchronous operation or loading state in the UI. This can help the LLM anticipate delays.

**Example Snippets (React/JSX):**

Below are examples showing how to apply these attributes to common HTML elements.

- **Simple Button:**

  ```html
  <button
    data-mcp-interactive-element="submit-button"
    data-mcp-element-type="button"
    data-mcp-element-label="Submit Form"
    data-mcp-purpose="Submits the current form data."
    onClick="{handleSubmit}"
  >
    Submit
  </button>
  ```

- **Text Input:**

  ```html
  <input
    type="text"
    id="username-input"
    data-mcp-interactive-element="username-field"
    data-mcp-element-type="text_input"
    data-mcp-element-label="Username"
    data-mcp-purpose="Enter your username."
    data-mcp-value-source-prop="value"
  />
  ```

- **Checkbox:**

  ```html
  <input
    type="checkbox"
    id="terms-checkbox"
    data-mcp-interactive-element="terms-checkbox"
    data-mcp-element-type="checkbox"
    data-mcp-element-label="Agree to Terms"
    data-mcp-purpose="Confirm agreement to terms and conditions."
    data-mcp-checked-prop="checked"
  />
  <label htmlFor="terms-checkbox">I agree to the terms and conditions</label>
  ```

- **Select Dropdown:**

  ```html
  <select
    id="country-select"
    data-mcp-interactive-element="country-selector"
    data-mcp-element-type="select"
    data-mcp-element-label="Country Selector"
    data-mcp-purpose="Select your country of residence."
    data-mcp-value-source-prop="value"
  >
    <option value="us" data-mcp-element-label="United States Option">
      United States
    </option>
    <option value="ca" data-mcp-element-label="Canada Option">Canada</option>
    <option value="gb" data-mcp-element-label="United Kingdom Option">
      United Kingdom
    </option>
  </select>
  ```

- **Radio Button Group:**

  ```html
  <div role="radiogroup" aria-labelledby="payment-method-label">
    <span
      id="payment-method-label"
      data-mcp-element-label="Payment Method Options"
    >
      Choose Payment Method:
    </span>
    <div>
      <input
        type="radio"
        id="cc-radio"
        name="paymentMethod"
        value="credit_card"
        data-mcp-interactive-element="payment-type-cc"
        data-mcp-element-type="radio"
        data-mcp-element-label="Credit Card Radio Button"
        data-mcp-radio-group-name="paymentMethod"
        data-mcp-checked-prop="checked"
      />
      <label htmlFor="cc-radio">Credit Card</label>
    </div>
    <div>
      <input
        type="radio"
        id="paypal-radio"
        name="paymentMethod"
        value="paypal"
        data-mcp-interactive-element="payment-type-paypal"
        data-mcp-element-type="radio"
        data-mcp-element-label="PayPal Radio Button"
        data-mcp-radio-group-name="paymentMethod"
        data-mcp-checked-prop="checked"
      />
      <label htmlFor="paypal-radio">PayPal</label>
    </div>
  </div>
  ```

- **Display Container/Region with Text Items:**
  ```html
  <div
    data-mcp-region="user-profile-card"
    data-mcp-purpose="Displays user profile information such as name and email."
  >
    <h2 data-mcp-display-item-text data-mcp-display-item-id="user-name-display">
      User Name Example
    </h2>
    <p data-mcp-display-item-text data-mcp-display-item-id="user-email-display">
      user@example.com
    </p>
    <button
      data-mcp-interactive-element="edit-profile-button"
      data-mcp-element-type="button"
      data-mcp-element-label="Edit Profile"
      data-mcp-purpose="Navigates to the profile editing page."
      data-mcp-navigates-to="/profile/edit"
    >
      Edit Profile
    </button>
  </div>
  ```

By thoughtfully applying these attributes, you provide a rich, semantic understanding of your application to the LLM, enabling robust and reliable automated interaction.

This instrumentation is the cornerstone of aligning your frontend with the `mcp-ui-bridge` design philosophy: build for humans, annotate for LLMs, and serve both effectively from a single codebase.

## Development (Contributing to `mcp-ui-bridge`)

If you want to contribute to the `mcp-ui-bridge` library itself (the code in this `react-cli-mcp` directory):

1.  Clone the main repository: `https://github.com/SDCalvo/mcp-ui-bridge.git`
2.  Navigate to this directory: `cd react-cli-mcp`
3.  Install dependencies: `npm install`
4.  Build: `npm run build` (compiles TypeScript to `dist`)
5.  Run in dev mode: `npm run dev` (watches for changes, rebuilds, and restarts the `dist/main.js` entry point for testing).
    - Note: `dist/main.js` is a simple script that uses `runMcpServer` with environment variables. You'll need to set `MCP_TARGET_URL` to a running web application for it to be useful.

## License

This library is licensed under the MIT License. See the `LICENSE` file for details.
