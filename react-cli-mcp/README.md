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

## How It Works

1.  **Semantic Instrumentation (by You)**: You, as the developer of a web application, annotate your HTML elements with specific `data-mcp-*` attributes (detailed below). These attributes provide semantic meaning about your UI's structure, interactive elements, and their purpose.
2.  **`DomParser` (within `mcp-ui-bridge`)**: When the MCP server (created by `runMcpServer`) is active and connected to your `targetUrl`, its internal `DomParser` module uses Playwright to access the live DOM of your web application. It scans for the `data-mcp-*` attributes you've added.
3.  **Structured Data Extraction**: The `DomParser` extracts a structured JSON representation of the page, including its current URL, identified interactive elements (buttons, inputs, links, custom elements), display data (from containers and regions), and their associated semantic information (labels, purposes, values).
4.  **`PlaywrightController` (within `mcp-ui-bridge`)**: When an LLM client sends a command (e.g., `click #buttonId`, `type #inputId "text"`) to the MCP server, the server uses its internal `PlaywrightController` module. This module translates the MCP command into Playwright actions and executes them reliably on the live web page.
5.  **MCP Server & Tools**: The server, powered by `FastMCP`, exposes standardized MCP tools to the LLM client:
    - `get_current_screen_data`: Allows the LLM to "see" the current state of the web page as the structured JSON data extracted by `DomParser`.
    - `get_current_screen_actions`: Provides the LLM with a list of suggested actions and command hints based on the currently visible and enabled interactive elements.
    - `send_command`: Enables the LLM to execute the desired interaction on the page.

## Instrumenting Your Frontend: The `data-mcp-*` Attributes

The core philosophy of `mcp-ui-bridge` is **LLM-Oriented Accessibility**. This is achieved by instrumenting your web application's HTML with specific `data-mcp-*` attributes. These attributes provide semantic meaning, allowing the `DomParser` within the `mcp-ui-bridge` library to understand the structure, interactive elements, and purpose of your UI, and then convey this understanding to an LLM.

Here are the key `data-mcp-*` attributes:

| Attribute                      | Purpose                                                                                                | Value(s) / Notes                                                                                                        | Example Usage                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `data-mcp-interactive-element` | **Required for most interactive elements.** Marks an element that the LLM can interact with.           | Can be empty. If the element is not an `input`, `button`, `select`, `a`, or `textarea`, this value is used as its `id`. | `<div data-mcp-interactive-element="custom-button">Click Me</div>`                |
| `data-mcp-element-label`       | Provides a human-readable label for the element. Crucial for LLM understanding.                        | String (e.g., "Submit Form", "User Name Input")                                                                         | `<input data-mcp-element-label="User Name Input">`                                |
| `data-mcp-element-type`        | Explicitly defines the type of a custom interactive element (if not a standard HTML tag).              | String (e.g., "custom-slider", "date-picker")                                                                           | `<div data-mcp-interactive-element data-mcp-element-type="star-rating">...</div>` |
| `data-mcp-current-value`       | For custom elements, explicitly provides their current value if not readable from standard properties. | String                                                                                                                  | `<div data-mcp-current-value="75%">...</div>`                                     |
| `data-mcp-purpose`             | Describes the high-level goal or function of the element or a region.                                  | String (e.g., "submit-user-profile", "display-search-results")                                                          | `<button data-mcp-purpose="submit-user-profile">Save</button>`                    |
| `data-mcp-container-id`        | Groups related items, often used for lists or collections of data. Parsed into `structuredData`.       | String (unique ID for the container)                                                                                    | `<ul data-mcp-container-id="todo-list">...</ul>`                                  |
| `data-mcp-item-text`           | Identifies the text content of an item within a `data-mcp-container-id`. Parsed into `structuredData`. | String (extracted from the element's text content if not specified)                                                     | `<li data-mcp-item-text>Buy milk</li>`                                            |
| `data-mcp-region-id`           | Defines a semantic region on the page. Parsed into `structuredData`.                                   | String (unique ID for the region)                                                                                       | `<section data-mcp-region-id="user-settings">...</section>`                       |
| `data-mcp-navigates-to`        | For `<a>` tags or custom navigation elements, indicates the destination URL or view.                   | String (URL or logical view name)                                                                                       | `<a data-mcp-navigates-to="/profile">Profile</a>`                                 |
| `data-mcp-updates-container`   | Indicates which `data-mcp-container-id` or `data-mcp-region-id` this element might modify or refresh.  | String (ID of the container/region)                                                                                     | `<button data-mcp-updates-container="todo-list">Add</button>`                     |
| `data-mcp-controls-element`    | Links an interactive element (like a button) to the element it primarily controls (like an input).     | String (ID of the controlled element)                                                                                   | `<button data-mcp-controls-element="username-input">...</button>`                 |
| `data-mcp-is-disabled`         | Explicitly marks an element as disabled if the standard `disabled` attribute isn't sufficient/used.    | "true" or "false"                                                                                                       | `<div data-mcp-is-disabled="true">Cannot click</div>`                             |
| `data-mcp-is-readonly`         | Explicitly marks an element as read-only.                                                              | "true" or "false"                                                                                                       | `<div data-mcp-is-readonly="true">View Only</div>`                                |
| `data-mcp-is-checked`          | For custom checkbox-like elements, explicitly provides their checked state.                            | "true" or "false"                                                                                                       | `<div data-mcp-is-checked="true">Subscribed</div>`                                |
| `data-mcp-custom-state`        | For elements with complex states beyond simple values, allows exposing a descriptive state string.     | String (e.g., "expanded", "loading", "error")                                                                           | `<div data-mcp-custom-state="expanded">Details</div>`                             |

By thoughtfully applying these attributes, you create a rich, semantic layer over your existing UI. The `DomParser` uses this layer to generate the `currentUrl`, `structuredData` (from containers and regions), and `interactiveElements` (with their labels, types, values, and purposes) that are sent to the LLM. This enables the LLM to "understand" the page contextually and perform actions accurately.

This instrumentation is the cornerstone of aligning your frontend with the `mcp-ui-bridge` design philosophy: build for humans, annotate for LLMs, and serve both effectively from a single codebase.

## Development (Contributing to `mcp-ui-bridge`)

If you want to contribute to the `mcp-ui-bridge` library itself (the code in this `react-cli-mcp` directory):

1.  **Clone the main repository:** [https://github.com/SDCalvo/mcp-ui-bridge.git](https://github.com/SDCalvo/mcp-ui-bridge.git)
2.  **Navigate to this directory:** `cd react-cli-mcp`
3.  **Install dependencies:** `npm install`
4.  **Build:** `npm run build` (compiles TypeScript to `dist`)
5.  **Run in dev mode:** `npm run dev` (watches for changes, rebuilds, and restarts the `dist/main.js` entry point for testing).
    - Note: `dist/main.js` is a simple script that uses `runMcpServer` with environment variables. You'll need to set `MCP_TARGET_URL` to a running web application for it to be useful.

## License

This library is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
