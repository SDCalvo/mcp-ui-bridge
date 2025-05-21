# `mcp-ui-bridge`: LLM-Oriented Web Accessibility Bridge

**`mcp-ui-bridge` is a project dedicated to making web applications natively and equally accessible to both human users and Large Language Models (LLMs) through a single, unified development effort.**

It embodies the concept of **LLM-Oriented Accessibility**: a new paradigm for web interaction. Instead of forcing LLMs to interpret visual UIs (often unreliably) or requiring developers to build separate, limited APIs for them, LLM-Oriented Accessibility focuses on providing LLMs with a structured, text-based, and semantically rich understanding of a web application. This is achieved by instrumenting the web application with `data-mcp-*` attributes that the `mcp-ui-bridge` tool can then parse and expose via a Model Context Protocol (MCP) server.

The core philosophy is **"Code Once, Serve All."** Developers build their rich visual UI for humans as they normally would, and by adding these semantic attributes, the _same_ application becomes fully understandable and operable by LLMs. This approach respects the strengths of both humans (visual intuition) and LLMs (text processing, automation) by providing each with an interface optimized for their needs, all stemming from a single source of truth: your application code.

## Key Benefits of LLM-Oriented Accessibility with `mcp-ui-bridge`

Adopting this approach offers several powerful advantages:

- **True Feature Parity (Code Once, Serve All):** LLMs interact with the same application logic and features as human users because it _is_ the same application. There's no need to develop and maintain a separate, often lagging, API for AI agents. New features become instantly accessible to both humans and LLMs once instrumented.
- **Simplified and Future-Proof Development:** Adding `data-mcp-*` attributes is a lightweight process that augments existing HTML. This significantly reduces the overhead compared to building bespoke LLM APIs. As the visual UI evolves, the LLM's understanding evolves with it, provided the semantic attributes are maintained.
- **Empowering LLMs as Advanced Testers:** By providing a clear, structured view of the application state and available actions, `mcp-ui-bridge` inherently enables sophisticated automated testing by LLMs. An LLM can programmatically navigate, interact with elements, input data, and verify outcomes based on the semantic information provided, going far beyond traditional brittle UI automation scripts.
- **Enabling LLM-Assisted Development Workflows:** Imagine an LLM in your IDE (like Cursor or a similar AI-powered coding assistant). With `mcp-ui-bridge`, this LLM can not only help you _write_ code for a new feature but can then immediately _interact_ with that feature on the live development server using the exposed MCP tools. It can perform test actions, report back on the UI state, and help you debug in a tight, iterative loop, significantly accelerating development and improving quality.
- **Enhanced LLM Reliability:** By interacting with a structured, text-based representation, LLMs avoid the pitfalls of visual interpretation (misreading text, misinterpreting icons, errors with coordinates), leading to more reliable and predictable interactions.

## Repository Structure

This repository contains the `mcp-ui-bridge` tool and a sample application to demonstrate its capabilities:

- **`/frontend`**: Contains a sample TodoMVC web application. This is the application that `mcp-ui-bridge` will interact with.
- **`/backend`**: Contains a simple mock backend server that the TodoMVC `frontend` application uses for its data persistence (if applicable to your frontend's setup).
- **`/react-cli-mcp`**: This is the core `mcp-ui-bridge` tool itself.
  - **Note on Naming**: While the project is now called `mcp-ui-bridge` (as it's framework-agnostic), this directory retains its original name `react-cli-mcp` to avoid potential issues with GitHub repository history and continuity. The tool within this folder is the `mcp-ui-bridge`.

## How It Works: A High-Level View

1.  **Semantic Instrumentation**: Developers annotate their web application's HTML elements with specific `data-mcp-*` attributes (e.g., `data-mcp-interactive-element`, `data-mcp-element-label`, `data-mcp-purpose`). These attributes provide semantic meaning about the UI's structure, interactive elements, and their purpose.
2.  **`DomParser`**: This module, running within the `mcp-ui-bridge` tool, uses Playwright to connect to the target web application. It scans the live DOM for the `data-mcp-*` attributes and extracts a structured JSON representation of the page's interactive elements and display data.
3.  **`PlaywrightController`**: When an LLM decides to perform an action, this module uses Playwright to execute those actions (e.g., clicks, typing, selections) reliably on the live web page.
4.  **MCP Server**: `mcp-ui-bridge` runs an MCP server (using `FastMCP`) that exposes a standardized set of tools to an LLM:
    - `get_current_screen_data`: Allows the LLM to "see" the current state of the web page as structured data.
    - `get_current_screen_actions`: Provides the LLM with a list of suggested actions and command hints.
    - `send_command`: Enables the LLM to execute actions like `click #id` or `type #id "text"`.

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

### 4. Using `mcp-ui-bridge` with Cursor

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

## Current Features (Highlights from `PLAN.md`)

- **Functional MCP Server:** Robust server implementation using `FastMCP`.
- **Playwright Integration:** Manages browser instances and interactions.
- **`DomParser`:** Analyzes the live DOM based on `data-mcp-*` attributes.
- **Core MCP Tools:**
  - `get_current_screen_data`: Fetches structured data and interactive elements.
  - `get_current_screen_actions`: Derives actionable commands and hints.
  - `send_command`: Executes actions like `click`, `type`, `select`, `check`, `uncheck`, `choose` (radio), `hover`, `clear`.
- **Configurable:** Supports environment variables and programmatic options for server settings.
- **ES Module Compatible.**

## Roadmap & Future Work (Key Items from `PLAN.md`)

This project is actively being developed. Key areas in our roadmap include:

- **Phase 3.4: Testing & Validation:**
  - Comprehensive unit and integration tests.
  - Performance testing.
- **Phase 3.5: Package as a Turnkey MCP Server/Tool:**
  - Create configurable entry points (CLI command, programmatic API).
  - Package for easy distribution (e.g., via npm).
  - Improve documentation for tool usage and `data-mcp-*` attribute specification.
- **Phase 3.5 (Renamed): Deployment & Production Considerations:** (Originally Phase 3.6 in some discussions)
  - Strategies for authentication/authorization.
  - Robustness for deployed environments (timeouts, retries).
  - Session management and state persistence considerations.
  - Security audit and hardening.
- **Further `send_command` Expansion:** Support for more complex interactions if identified.
- **Refined Error Handling & Robustness:** Continuous improvements.
- **Development of a dedicated MCP Test Client.**

We believe this project lays the groundwork for a new era of LLM-web interaction, making applications truly and equally usable for both human and artificial intelligence.

---

_This `README.md` was co-authored by Santiago Calvo and Gemini 2.5 Pro._
