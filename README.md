# `mcp-ui-bridge`: LLM-Oriented Web Accessibility Bridge

[![npm version](https://badge.fury.io/js/mcp-ui-bridge.svg)](https://badge.fury.io/js/mcp-ui-bridge)
[View on npm](https://www.npmjs.com/package/mcp-ui-bridge)

**`mcp-ui-bridge` is a project dedicated to making web applications natively and equally accessible to both human users and Large Language Models (LLMs) through a single, unified development effort.**

**Available in both TypeScript/Node.js and Python implementations** for maximum flexibility and integration with your existing tech stack.

It embodies the concept of **LLM-Oriented Accessibility**: a new paradigm for web interaction. Instead of forcing LLMs to interpret visual UIs (often unreliably) or requiring developers to build separate, limited APIs for them, LLM-Oriented Accessibility focuses on providing LLMs with a structured, text-based, and semantically rich understanding of a web application. This is achieved by instrumenting the web application with `data-mcp-*` attributes that the `mcp-ui-bridge` tool can then parse and expose via a Model Context Protocol (MCP) server.

The core philosophy is **"Code Once, Serve All."** Developers build their rich visual UI for humans as they normally would, and by adding these semantic attributes, the _same_ application becomes fully understandable and operable by LLMs. This approach respects the strengths of both humans (visual intuition) and LLMs (text processing, automation) by providing each with an interface optimized for their needs, all stemming from a single source of truth: your application code.

## Key Benefits of LLM-Oriented Accessibility with `mcp-ui-bridge`

Adopting this approach offers several powerful advantages:

- **True Feature Parity (Code Once, Serve All):** LLMs interact with the same application logic and features as human users because it _is_ the same application. There's no need to develop and maintain a separate, often lagging, API for AI agents. New features become instantly accessible to both humans and LLMs once instrumented.
- **Simplified and Future-Proof Development:** Adding `data-mcp-*` attributes is a lightweight process that augments existing HTML. This significantly reduces the overhead compared to building bespoke LLM APIs. As the visual UI evolves, the LLM's understanding evolves with it, provided the semantic attributes are maintained.
- **Empowering LLMs as Advanced Testers:** By providing a clear, structured view of the application state and available actions, `mcp-ui-bridge` inherently enables sophisticated automated testing by LLMs. An LLM can programmatically navigate, interact with elements, input data, and verify outcomes based on the semantic information provided, going far beyond traditional brittle UI automation scripts.
- **Enabling LLM-Assisted Development Workflows:** Imagine an LLM in your IDE (like Cursor or a similar AI-powered coding assistant). With `mcp-ui-bridge`, this LLM can not only help you _write_ code for a new feature but can then immediately _interact_ with that feature on the live development server using the exposed MCP tools. It can perform test actions, report back on the UI state, and help you debug in a tight, iterative loop, significantly accelerating development and improving quality.
- **Enhanced LLM Reliability:** By interacting with a structured, text-based representation, LLMs avoid the pitfalls of visual interpretation (misreading text, misinterpreting icons, errors with coordinates), leading to more reliable and predictable interactions.
- **Language Flexibility:** Choose the implementation that best fits your infrastructure - TypeScript/Node.js for JavaScript-heavy environments or Python for data science, AI/ML, and automation workflows.

## Repository Structure

This repository contains implementations of the `mcp-ui-bridge` tool in both TypeScript and Python, along with sample applications to demonstrate their capabilities:

**Core Libraries:**

- **`/react-cli-mcp`**: The original TypeScript/Node.js implementation of `mcp-ui-bridge`
  - **Note on Naming**: While the project is now called `mcp-ui-bridge` (as it's framework-agnostic), this directory retains its original name `react-cli-mcp` to avoid potential issues with GitHub repository history and continuity. The tool within this folder is the `mcp-ui-bridge`.
- **`/mcp-ui-bridge-python`**: The Python implementation of `mcp-ui-bridge` with full feature parity

**Sample Applications:**

- **`/frontend`**: Contains a sample TodoMVC web application. This is the application that `mcp-ui-bridge` will interact with.
- **`/backend`**: Contains a simple mock backend server that the TodoMVC `frontend` application uses for its data persistence (if applicable to your frontend's setup).

**Example Servers:**

- **`/mcp-external-server`**: Pre-configured TypeScript application that uses the `react-cli-mcp` library to connect to your frontend (recommended way to run the TypeScript bridge)
- **`/mcp-external-server-python`**: Pre-configured Python application that uses the `mcp-ui-bridge-python` library (recommended way to run the Python bridge)

Both implementations provide identical functionality and MCP tool interfaces, so you can choose based on your preferred language and existing infrastructure.

## How It Works: A High-Level View

1.  **Semantic Instrumentation**: Developers annotate their web application's HTML elements with specific `data-mcp-*` attributes (e.g., `data-mcp-interactive-element`, `data-mcp-element-label`, `data-mcp-purpose`). These attributes provide semantic meaning about the UI's structure, interactive elements, and their purpose.
2.  **`DomParser`**: This module, running within the `mcp-ui-bridge` tool, uses Playwright to connect to the target web application. It scans the live DOM for the `data-mcp-*` attributes and extracts a structured JSON representation of the page's interactive elements and display data.
3.  **`PlaywrightController`**: When an LLM decides to perform an action, this module uses Playwright to execute those actions (e.g., clicks, typing, selections) reliably on the live web page.
4.  **MCP Server**: `mcp-ui-bridge` runs an MCP server (using `FastMCP`) that exposes a standardized set of tools to an LLM:
    - `get_current_screen_data`: Allows the LLM to "see" the current state of the web page as structured data.
    - `get_current_screen_actions`: Provides the LLM with a list of suggested actions and command hints.
    - `send_command`: Enables the LLM to execute actions like `click #id` or `type #id "text"`.

## Instrumenting Your Frontend

To make your web application understandable and operable by `mcp-ui-bridge`, you need to add `data-mcp-*` attributes to your HTML elements. These attributes provide the semantic information that the bridge uses to interact with your UI.

Here are some common examples:

**Key Attributes:**

- `data-mcp-interactive-element="unique-id"`: Marks an element as interactive. The ID should be unique within the currently rendered view.
- `data-mcp-element-type="<type>"`: Specifies the type of interactive element (e.g., `button`, `text_input`, `select`, `checkbox`, `radio`).
- `data-mcp-element-label="<label>"`: A human-readable label for the element, often derived from visible text or an `aria-label`. This helps the LLM understand the element's purpose.
- `data-mcp-purpose="<description>"`: A more detailed description of what the element does or is for.
- `data-mcp-value-source-prop="<prop>"`: For inputs, specifies which JavaScript property holds the element's current value (e.g., `"value"`, `"checked"`).
- `data-mcp-checked-prop="<prop>"`: For checkboxes or radio buttons, specifies the property indicating its checked state (usually `"checked"`).
- `data-mcp-radio-group-name="<name>"`: For radio buttons, specifies the `name` attribute of the radio group they belong to. This is crucial for identifying and interacting with the correct group.
- `data-mcp-region="<region-id>"`: Defines a logical section or container on the page.
- `data-mcp-display-item-text`: Marks an element whose `innerText` should be captured as display data.
- `data-mcp-display-item-id="<unique-id>"`: A unique ID for a display item, allowing the LLM to reference specific pieces of text.
- `data-mcp-navigates-to="<url_or_identifier>"`: Indicates that interacting with this element will cause a navigation.
- `data-mcp-triggers-loading="true"`: Indicates that interacting with this element may trigger a loading state.

**Example Snippets (React/JSX):**

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
  <input type="text" id="username-input"
  data-mcp-interactive-element="username-field"
  data-mcp-element-type="text_input" data-mcp-element-label="Username"
  data-mcp-purpose="Enter your username." data-mcp-value-source-prop="value" //
  Assumes 'value' prop holds the input's content value={username} onChange={(e)
  => setUsername(e.target.value)} />
  ```

- **Checkbox:**

  ```html
  <input type="checkbox" id="terms-checkbox"
  data-mcp-interactive-element="terms-checkbox" data-mcp-element-type="checkbox"
  data-mcp-element-label="Agree to Terms" data-mcp-purpose="Confirm agreement to
  terms and conditions." data-mcp-checked-prop="checked" // Assumes 'checked'
  prop holds the state checked={agreedToTerms} onChange={(e) =>
  setAgreedToTerms(e.target.checked)} />
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
    value={selectedCountry}
    onChange={(e) => setSelectedCountry(e.target.value)}
  >
    <option value="us" data-mcp-element-label="United States Option">United States</option>
    <option value="ca" data-mcp-element-label="Canada Option">Canada</option>
    <option value="gb" data-mcp-element-label="United Kingdom Option">United Kingdom</option>
  </select>
  ```

- **Radio Button Group:**

  ```html
  <div role="radiogroup" aria-labelledby="payment-method-label">
    <span
      id="payment-method-label"
      data-mcp-element-label="Payment Method Options"
      >Choose Payment Method:</span
    >
    <div className="form-check">
      // Example class, not MCP related <input type="radio" id="cc-radio"
      name="paymentMethod" // HTML name attribute for grouping
      value="credit_card" data-mcp-interactive-element="payment-type-cc"
      data-mcp-element-type="radio" data-mcp-element-label="Credit Card Radio
      Button" data-mcp-radio-group-name="paymentMethod" // MCP attribute for
      identifying the group data-mcp-checked-prop="checked" checked={paymentType
      === 'credit_card'} onChange={(e) => setPaymentType(e.target.value)} />
      <label htmlFor="cc-radio">Credit Card</label>
    </div>
    <div className="form-check">
      <input type="radio" id="paypal-radio" name="paymentMethod" value="paypal"
      data-mcp-interactive-element="payment-type-paypal"
      data-mcp-element-type="radio" data-mcp-element-label="PayPal Radio Button"
      data-mcp-radio-group-name="paymentMethod" data-mcp-checked-prop="checked"
      checked={paymentType === 'paypal'} onChange={(e) =>
      setPaymentType(e.target.value)} />
      <label htmlFor="paypal-radio">PayPal</label>
    </div>
  </div>
  ```

- **Display Container/Region:**
  ```html
  <div
    data-mcp-region="user-profile-card"
    data-mcp-purpose="Displays user profile information."
  >
    <h2 data-mcp-display-item-text data-mcp-display-item-id="user-name-display">
      {user.name}
    </h2>
    <p data-mcp-display-item-text data-mcp-display-item-id="user-email-display">
      {user.email}
    </p>
  </div>
  ```

By thoughtfully applying these attributes, you empower `mcp-ui-bridge` to understand and interact with your application as effectively as a human user, enabling a new level of LLM-driven automation and assistance.

## Getting Started: Running the Project

### Prerequisites

- Node.js (v18.x or later recommended)
- npm (usually comes with Node.js)
- A web browser compatible with Playwright (e.g., Chromium, Firefox, WebKit - Playwright will download these if not found, but `npx playwright install` in the `react-cli-mcp` directory can pre-install them).

### 1. Running the Frontend (TodoMVC App)

The frontend is a standard Vite-based React application.

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server (usually on http://localhost:5173)
npm run dev
```

Leave this terminal running.

### 2. Running the Backend (Mock Server for TodoMVC)

The sample TodoMVC application might require a mock backend for full functionality.

- **Option A: If it has its own server (e.g., Express)**

  ```bash
  # Navigate to the backend directory
  cd backend

  # Install dependencies (if any)
  npm install

  # Start the backend server (check its package.json for the correct command)
  npm start # or npm run dev, etc.
  ```

- **Option B: Using Visual Studio Code Debugger**
  If the backend is set up to be run via a VS Code launch configuration:
  1.  Open the project in Visual Studio Code.
  2.  Navigate to the "Run and Debug" panel.
  3.  Select the appropriate launch configuration for the backend (e.g., "Run Backend Server").
  4.  Start debugging (usually F5).
- **Option C: If no separate backend server is needed by the frontend**
  Some simple frontends (especially TodoMVC examples) might use browser `localStorage` and not require a separate backend. If so, you can skip this step.

_(Please verify the exact setup of your `/backend` and update these instructions if necessary. If it doesn't require running, state that clearly.)_

### 3. Running `mcp-ui-bridge` (the `react-cli-mcp` tool)

This is the core tool that will connect to the running frontend.

```bash
# Navigate to the mcp-ui-bridge tool directory
cd react-cli-mcp

# Install dependencies
npm install

# Ensure Playwright browsers are installed (optional, but good practice)
# npx playwright install

# Build the project (compile TypeScript to JavaScript)
npm run build

# Start the mcp-ui-bridge server
npm run start
```

**Environment Variables for `mcp-ui-bridge`:**

When running `npm run start` for `mcp-ui-bridge`, it will look for the following environment variables (you can set these in your terminal, in a `.env` file via `dotenv`, or by prefixing the start command):

- `MCP_TARGET_URL`: The URL of the web application you want `mcp-ui-bridge` to connect to. For the sample frontend, this will likely be `http://localhost:5173`.
  - Example: `MCP_TARGET_URL=http://localhost:5173 npm run start`
- `MCP_HEADLESS_BROWSER`: Set to `true` to run the Playwright browser in headless mode (no visible UI), or `false` (default) to see the browser window.
  - Example: `MCP_HEADLESS_BROWSER=true MCP_TARGET_URL=http://localhost:5173 npm run start`
- `MCP_PORT`: The port on which the `mcp-ui-bridge` MCP server will listen (default: `3000`).
- `MCP_SSE_ENDPOINT`: The SSE endpoint for MCP communication (default: `/mcp/sse`).
- `MCP_SERVER_NAME`: Optional name for the MCP server.
- `MCP_SERVER_VERSION`: Optional version for the MCP server (e.g., "1.0.3").

Once `mcp-ui-bridge` starts successfully, it will connect to the `MCP_TARGET_URL`, and an MCP client (like an LLM integrated with an MCP library) can connect to `mcp-ui-bridge` (e.g., at `http://localhost:3000/mcp/sse`) to start interacting with the web application.

### 4. Running the `mcp-external-server` (Primary Way to Use the Bridge)

The `mcp-external-server` is a pre-configured application that uses the `react-cli-mcp` library to connect to your frontend. This is the recommended way to run the MCP bridge.

```bash
# Navigate to the mcp-external-server directory
cd mcp-external-server

# Install dependencies
npm install

# Start the server (uses ts-node-dev or nodemon for auto-reloading TypeScript changes)
npm run dev
```

The server will typically start on `http://localhost:8070`.

**Configuration for `mcp-external-server`:**

The primary configuration for `mcp-external-server` is done within its `src/index.ts` file, where `McpServerOptions` are set. However, it's coded to respect the following environment variables (which can override the defaults in `src/index.ts`):

- `MCP_TARGET_URL`: The URL of the web application (e.g., `http://localhost:5173` for the sample frontend).
- `MCP_PORT`: The port for the `mcp-external-server` to listen on (default: `8070`).
- `MCP_HEADLESS_BROWSER`: Set to `true` for headless mode, `false` (default) to see the browser.

Example: `MCP_TARGET_URL=http://localhost:5173 npm run dev`

The `mcp-external-server` also includes a toy authentication mechanism in its `src/index.ts` (the `MANUALLY_ALLOW_CONNECTION` variable) for testing purposes.

### 5. Alternative: Running the Python Version

If you prefer Python, you can use the Python implementation instead:

```bash
# Navigate to the Python external server directory
cd mcp-external-server-python

# Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the Python MCP server
python src/main.py
```

The Python server will start on `http://localhost:8080` by default.

**Configuration for Python version:**

The Python version can be configured using the same environment variables:

- `MCP_TARGET_URL`: The URL of the web application (e.g., `http://localhost:5173`)
- `MCP_PORT`: The port for the server to listen on (default: `8080`)
- `MCP_HEADLESS_BROWSER`: Set to `"true"` for headless mode, `"false"` (default) to see the browser

Example: `MCP_TARGET_URL=http://localhost:5173 python src/main.py`

### 6. Using `mcp-ui-bridge` with Cursor

To enable an LLM within Cursor (like the Cursor agent) to use the tools provided by `mcp-ui-bridge` and interact with your running web application, follow these steps:

**Prerequisites:**

- Ensure your **frontend application** is running (e.g., `npm run dev` in the `/frontend` directory).
- Ensure your **backend server** (if required by your frontend) is running.
- Ensure the **`mcp-ui-bridge` server** itself is running (e.g., `npm run start` in the `/react-cli-mcp` directory after an `npm run build`).

**Configuration:**

1.  **`.cursor/mcp.json` File:** This project includes a `.cursor/mcp.json` file in the root directory, which defines the MCP server for Cursor. It typically looks like this:

    ```json
    {
      "mcpServers": {
        "react-app-mcp-agent": {
          // This key is the server name displayed in Cursor
          "transport": "sse",
          "url": "http://localhost:3000/mcp/sse", // Matches MCP_PORT and MCP_SSE_ENDPOINT defaults
          "description": "MCP server for interacting with the target web application via mcp-ui-bridge and Playwright."
        }
      }
    }
    ```

    This file tells Cursor how to find and identify your local `mcp-ui-bridge` server.

2.  **Enable in Cursor Settings:**

    - Open the Command Palette in Cursor (Ctrl+Shift+P on Windows/Linux, Cmd+Shift+P on macOS).
    - Type `Cursor Settings` and select it to open Cursor's settings UI.
    - In the settings, find the section related to "Model Context Protocol (MCP)" or "MCP Servers".
    - You should see an entry for your MCP server, likely named "react-app-mcp-agent" (or whatever key is used in `mcp.json`), listed as "Project Managed".
    - Enable this server using the toggle switch next to its name.

    _(You can add a screenshot here similar to the one provided in the issue, showing the MCP Servers settings in Cursor with the project-managed server enabled.)_

**Outcome:**

Once enabled, the Cursor agent will have access to the following tools from `mcp-ui-bridge`:

- `get_current_screen_data`
- `get_current_screen_actions`
- `send_command`

This allows you to instruct Cursor to interact with your web application, test features, and assist in development in a tight iterative loop, as described in the "Key Benefits" section.

## Using `mcp-ui-bridge` as a Library

The `mcp-ui-bridge` package is designed to be used as a library within your own projects, allowing you to create a custom MCP server that bridges your web application to LLMs. Choose the implementation that best fits your tech stack:

### TypeScript/Node.js Implementation

#### Installation

Once published to npm:

```bash
npm install mcp-ui-bridge
```

For local development or if using it directly from this monorepo structure into a sibling project, you might use `npm link` or specify a file path in your `package.json` (referencing the `react-cli-mcp` directory if that's where the source lives before publishing under the new name):

```json
"dependencies": {
  "mcp-ui-bridge": "file:../path/to/react-cli-mcp" // Adjust path as needed
}
```

#### Basic Usage

Here's a minimal example of how to use `runMcpServer`:

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
    serverInstructions: "This bridge connects to My Awesome App.",
    // Optional: Implement custom client authentication
    authenticateClient: async (
      context: ClientAuthContext
    ): Promise<boolean> => {
      console.log(`Authentication attempt from IP: ${context.sourceIp}`);
      const apiKey = context.headers["x-my-app-api-key"];
      if (apiKey && apiKey === process.env.MY_EXPECTED_API_KEY) {
        console.log("Client authenticated successfully.");
        return true;
      }
      console.log("Client authentication failed.");
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

### Python Implementation

#### Installation

For local development using the Python implementation:

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the Python mcp-ui-bridge library (adjust path as needed)
pip install -e ./mcp-ui-bridge-python
```

#### Basic Usage

Here's a minimal example using the Python implementation:

```python
# your_custom_mcp_server.py
import asyncio
import os
from mcp_ui_bridge_python import run_mcp_server, McpServerOptions

async def authenticate_client(source_ip: str, headers: dict) -> bool:
    """Custom authentication logic"""
    print(f"Authentication attempt from IP: {source_ip}")
    api_key = headers.get("x-my-app-api-key")
    if api_key and api_key == os.getenv("MY_EXPECTED_API_KEY"):
        print("Client authenticated successfully.")
        return True
    print("Client authentication failed.")
    return False

async def start_my_mcp_bridge():
    options = McpServerOptions(
        target_url=os.getenv("MY_APP_URL", "http://localhost:3000"),
        port=int(os.getenv("MY_MCP_BRIDGE_PORT", "8090")),
        headless_browser=os.getenv("HEADLESS", "false").lower() != "false",
        server_name="My Custom MCP Bridge",
        server_version="1.0.0",
        server_instructions="This bridge connects to My Awesome App.",
        # Optional: Implement custom client authentication
        authenticate_client=authenticate_client
    )

    try:
        await run_mcp_server(options)
        print(f"My Custom MCP Bridge started on port {options.port}, targeting {options.target_url}")
    except Exception as error:
        print(f"Failed to start My Custom MCP Bridge: {error}")
        exit(1)

if __name__ == "__main__":
    asyncio.run(start_my_mcp_bridge())
```

### Key Configuration Options

Both implementations support the same core options (with language-appropriate naming conventions):

- `targetUrl`/`target_url` (string, required): The URL of the web application the MCP server will control.
- `port` (number/int, optional): Port for the MCP server. Defaults to `8080` if not set by `MCP_PORT` env var or this option.
- `headlessBrowser`/`headless_browser` (boolean, optional): Whether to run Playwright in headless mode. Defaults to `false`.
- `ssePath`/`sse_path` (string, optional): The path for the Server-Sent Events (SSE) endpoint. Defaults to `/sse`.
- `serverName`/`server_name` (string, optional): Name of your MCP server.
- `serverVersion`/`server_version` (string, optional): Version of your MCP server.
- `serverInstructions`/`server_instructions` (string, optional): Instructions for the LLM on how to use this server or the target application.
- `authenticateClient`/`authenticate_client` (function, optional): Custom authentication function.
  - TypeScript: `async (context: ClientAuthContext) => Promise<boolean>`
  - Python: `async (source_ip: str, headers: dict) => bool`
  - Return `true`/`True` to allow the connection, `false`/`False` to deny (results in a 401 response).

Using either library allows you to host this MCP bridge as part of a larger backend, deploy it as a standalone service, and integrate custom authentication seamlessly.

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

## Testing the Setup

Once all necessary components are running (Frontend, Backend (if any), and `mcp-external-server`), you can test the setup:

1.  **Connect with an MCP Client:** Use Cursor (configured as described above) or another MCP client to connect to the `mcp-external-server` (e.g., at `http://localhost:8070/sse`).
2.  **Test Basic Interaction:** Try using tools like `get_current_screen_data` or `send_command` to interact with your frontend application.
3.  **Test Authentication (Toy Implementation):**
    - The `mcp-external-server/src/index.ts` includes a simple authentication mechanism controlled by the `MANUALLY_ALLOW_CONNECTION` variable.
    - **To allow connections:** Set `MANUALLY_ALLOW_CONNECTION = true;` in `mcp-external-server/src/index.ts`. The MCP client should connect successfully.
    - **To deny connections:** Set `MANUALLY_ALLOW_CONNECTION = false;` in `mcp-external-server/src/index.ts`. The `nodemon` process (if using `npm run dev`) will restart the server. Attempts to connect with an MCP client should now fail (e.g., Cursor might show a connection error).
    - Check the console output of `mcp-external-server` for logs indicating authentication attempts and success/failure. This confirms the `authenticateClient` callback provided to `runMcpServer` is working.

_This `README.md` was co-authored by Santiago Calvo and Gemini 2.5 Pro._
