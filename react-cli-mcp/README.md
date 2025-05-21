# react-cli-mcp

`react-cli-mcp` is a Node.js library that enables Large Language Models (LLMs) to interact with React-based web applications. It uses the Model Context Protocol (MCP) for communication and Playwright for robust browser automation.

This library starts an MCP server that connects to a target web application, parses its DOM for specially annotated interactive elements, and exposes tools for the LLM to get screen data, see available actions, and send commands (like click, type, select, etc.).

## Features

- **MCP Server:** Implements the Model Context Protocol for LLM interaction.
- **Browser Automation:** Uses Playwright to control a headless or headed browser.
- **DOM Parsing:** Identifies interactive elements based on `data-mcp-*` attributes.
- **Core MCP Tools:**
  - `get_current_screen_data`: Fetches structured data and interactive elements.
  - `get_current_screen_actions`: Lists possible actions based on screen elements.
  - `send_command`: Executes actions like click, type, select, check, uncheck, choose, hover, and clear.
- **Programmatic Configuration:** Easy to integrate into other Node.js projects.

## Installation

To install `react-cli-mcp` as a dependency in your project:

```bash
npm install react-cli-mcp
# or
yarn add react-cli-mcp
```

_(Note: Replace `react-cli-mcp` with the actual package name if it's different on npm, or provide instructions for installing from GitHub if it's not yet on npm)._

## Usage

Here's a basic example of how to import and run the MCP server:

```typescript
import { runMcpServer, McpServerOptions } from "react-cli-mcp"; // Or your actual package name

async function startMyMcpAgent() {
  const options: McpServerOptions = {
    targetUrl: "http://localhost:3000", // URL of the React app you want to control
    headlessBrowser: false, // Run browser in headed mode (true for headless)
    mcpPort: 3001, // Port for the MCP server
    mcpSseEndpoint: "/mcp/sse", // SSE endpoint for MCP communication
    serverName: "MyCustomReactAgent",
    serverVersion: "1.0.0",
    // Optional server instructions for the LLM
    serverInstructions:
      "This agent controls a specific React application. Be mindful of the available actions.",
  };

  try {
    console.log("Attempting to start react-cli-mcp server...");
    await runMcpServer(options);
    console.log(
      `MCP Server for ${options.targetUrl} is running on port ${options.mcpPort}`
    );
    console.log(
      `Connect your MCP client to: http://localhost:${options.mcpPort}${options.mcpSseEndpoint}`
    );
  } catch (error) {
    console.error("Failed to start react-cli-mcp server:", error);
    process.exit(1);
  }
}

startMyMcpAgent();
```

## Configuration (`McpServerOptions`)

The `runMcpServer` function accepts an options object with the following properties:

- `targetUrl` (string, required): The URL of the React application the MCP server will connect to and control.
- `headlessBrowser` (boolean, required): Whether to run the Playwright browser in headless mode (`true`) or headed mode (`false`). Defaults to `false` if running `main.ts` directly, but should be explicitly set when using as a library.
- `mcpPort` (number, required): The port number on which the MCP server will listen.
- `mcpSseEndpoint` (\`/\${string}\`, required): The Server-Sent Events (SSE) endpoint path for MCP communication (must start with a `/`).
- `serverName` (string, optional): A name for your MCP server. Defaults to `"McpUiBridgeServer"` or similar.
- `serverVersion` (\`\${number}.\${number}.\${number}\`, optional): The version of your MCP server. Defaults to `"1.0.3"`.
- `serverInstructions` (string, optional): Custom instructions to be provided to the LLM connecting to this server.

## How it Works

1.  **Initialization**: When `runMcpServer` is called, it launches a Playwright instance (Chromium by default) and navigates to the specified `targetUrl`.
2.  **DOM Parsing**: `DomParser` inspects the live DOM of the target application. It looks for HTML elements tagged with specific `data-mcp-*` attributes to identify:
    - Interactive elements (buttons, inputs, selects, etc.)
    - Display containers and items
    - Page regions
    - Status messages and loading indicators
3.  **MCP Tool Exposure**: The server exposes standard MCP tools:
    - `get_current_screen_data`: Returns a JSON object representing the parsed structure of the page, including visible elements, their states (e.g., value, checked, disabled), and labels.
    - `get_current_screen_actions`: Returns a list of potential actions an LLM can take, along with command hints (e.g., `click #submit-button`, `type #email-input "user@example.com"`).
    - `send_command`: Allows the LLM to execute an action from the list. The `PlaywrightController` then performs the corresponding browser interaction (e.g., clicking a button, typing into a field).

## `data-mcp-*` Attributes

To make your React application compatible with `react-cli-mcp`, you need to annotate your HTML elements with `data-mcp-*` attributes. Key attributes include:

- `data-mcp-interactive-element="unique-id"`: Marks an element as interactive. The value should be a unique ID for that element.
- `data-mcp-element-type="input-text"`: (Optional) Explicitly define the element type if it cannot be inferred reliably from the tag name (e.g., a `<div>` styled as a button).
- `data-mcp-element-label="Descriptive Label"`: (Optional) Provide an explicit label if `aria-label`, `textContent`, or `placeholder` are not suitable.
- `data-mcp-purpose="describe-the-element-function"`: Describe what the element does.
- `data-mcp-display-container="container-id"`: Marks a container for display items.
- `data-mcp-display-item-text`: Marks an element within a display container whose text content is the primary item text.
- ... (refer to `src/types/attributes.ts` for a more comprehensive list).

## Development (react-cli-mcp itself)

To work on this library:

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Build the code: `npm run build`
4.  To run the server with a sample target (if `main.ts` is configured): `npm start`
5.  For development with auto-rebuild and auto-restart: `npm run dev`

## Contributing

Contributions are welcome! Please refer to the main project's contributing guidelines (if available) or open an issue to discuss potential changes.

## License

ISC (or specify your chosen license if different)
