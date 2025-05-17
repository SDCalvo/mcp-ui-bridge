# react-cli-mcp: Project Plan

## 1. Project Goal & Scope

- **Primary Goal**: To create a tool (`react-cli-mcp`) that enables a Large Language Model (LLM) to interact with React-based web applications through a terminal-like interface using the Model Context Protocol (MCP).
- **Core Functionality**:
  - Parse a target React application to identify interactive elements and their functionalities.
  - Generate a Command Line Interface (CLI) representation of the React application's interactive parts.
  - Facilitate communication between the LLM and the React app via this CLI, using MCP for structured data exchange.
- **Initial Scope (Todo App)**:
  - Successfully parse the existing Todo React application.
  - Identify interactive elements (input fields, buttons, checkboxes) based on `data-interactive-element` attributes.
  - Identify data display areas (e.g., lists of items, item content) based on attributes like `data-display-container` and `data-display-item-text`.
  - Expose actions like:
    - Adding a new todo.
    - Marking a todo as complete/incomplete.
    - Deleting a todo.
    - Listing current todos.
- **Out of Scope (Initially)**:
  - Complex navigation beyond simple views.
  - Dynamic rendering based on arbitrary state changes not tied to direct user actions.
  - Handling every possible type of React component or state management library.
  - Visual understanding of the UI (focus is on semantic interaction via attributes).

## 2. Core Components & High-Level Architecture

The `react-cli-mcp` system will consist of the following main components:

- **React App Parser**:
  - Responsible for analyzing the structure and interactive elements of the target React application.
  - Needs to identify elements marked with `data-interactive-element` (for interactive components) and attributes like `data-display-container` or `data-display-item-text` (for data display areas). It should extract relevant information (type, current state, associated actions, displayed text/data).
- **CLI Generation & Interaction Module / MCP Agent Core**:
  - This module is the heart of `react-cli-mcp`. It dynamically understands the current state of the React application via the React App Parser.
  - It doesn't generate a static CLI representation, but rather enables interaction through a few generic, stable MCP tools.
  - Manages the state of the interaction with the MCP-User (LLM), including understanding the current "view" or context within the React application.
  - Executes actions on the React app using Playwright, based on commands received via MCP.
- **MCP Integration Layer**:
  - Exposes a stable set of generic MCP tools (e.g., `get_current_screen_actions`, `get_current_screen_data`, `send_command`).
  - Formats messages (requests from MCP-User, responses from the tool) according to the Model Context Protocol.
  - Handles the lifecycle of an MCP interaction.
- **Server/Runtime Environment**:
  - Hosts the `react-cli-mcp` tool.
  - Runs a headless browser (Playwright) to interact with the React application.

### 2.1. Data Attributes for MCP Interaction

To establish a clear and stable contract between the target React application and the `react-cli-mcp` tool (for the mcp-user/LLM), specific `data-mcp-*` attributes are used. These allow developers to explicitly mark elements for MCP interaction.

**Current Core Attributes (Namespaced with `mcp-` to avoid conflicts):**

- `data-mcp-interactive-element="unique-id"`: Identifies elements the mcp-user can interact with (buttons, inputs, etc.). The value serves as a stable ID for the MCP tool to target the element.
- `data-mcp-display-container="unique-id"`: Marks a container for a list or group of related display items. The value is a unique ID for that container.
- `data-mcp-display-item-text`: Marks an individual piece of text content within a `data-mcp-display-container`. (Currently, the value of this attribute itself isn't used, but its presence identifies the element whose text content should be extracted.)

These core attributes are essential for the basic functioning of the parser and the MCP agent's ability to identify and interact with key parts of the application.

**Potential Future Data Attributes & Hybrid Strategy:**

As the system evolves, more descriptive information might be needed by the mcp-user. Instead of solely relying on new `data-mcp-*` attributes for every piece of information (which could lead to redundancy if standard HTML/ARIA attributes already provide it), a hybrid approach is envisioned:

1.  **Explicit `data-mcp-*` Attribute (Priority):** Developers can use a specific `data-mcp-*` attribute for fine-grained control over what the mcp-user sees.
2.  **Fallback to Standard HTML/ARIA Attributes:** If a specific descriptive `data-mcp-*` attribute is not present, the `ReactAppParser` will attempt to infer the information from common standard attributes.

Potential future attributes and their possible fallbacks include:

- `data-mcp-element-label="Descriptive Label"`:
  - **Purpose**: Provides an explicit, human-readable label for an interactive element.
  - **Fallbacks**: `aria-label`, element's `textContent` (e.g., for buttons), `placeholder` (for inputs), `title` attribute.
- `data-mcp-element-type="button | text-input | checkbox"`:
  - **Purpose**: Explicitly defines the type/role of an interactive element.
  - **Fallbacks**: Element's `tagName` (e.g., `button`, `input`, `select`), `type` attribute of an input (e.g., `text`, `checkbox`), `role` attribute.
- `data-mcp-element-state="active | expanded | selected"`:
  - **Purpose**: Declares the current state of an interactive element if not obvious from standard attributes.
  - **Fallbacks**: Standard HTML attributes like `disabled`, `checked`, `selected`; ARIA attributes like `aria-checked`, `aria-expanded`, `aria-selected`.
- `data-mcp-navigates-to="view-id | logical-name"`:
  - **Purpose**: For elements triggering navigation, indicates the destination.
  - **Fallbacks**: Potentially `href` for `<a>` tags, though mapping this to a logical view ID might still require some convention.
- `data-mcp-value="current-value"`:
  - **Purpose**: For custom controls where the value isn't in standard `value` or `textContent`.
  - **Fallbacks**: Standard `value` attribute, `textContent`.
- `data-mcp-display-item-id="unique-item-id"`:
  - **Purpose**: Provides a stable, unique ID for an item within a `data-mcp-display-container`, especially if `textContent` isn't unique or if actions target specific items.
  - **Fallbacks**: None directly; this would likely always need to be explicit if required.

This hybrid strategy aims to balance explicit control for developers with the convenience of leveraging existing, standard attributes, reducing annotation burden while ensuring the mcp-user gets rich context.

**High-Level Flow (Revised):**

1.  **Initialization**: `react-cli-mcp` starts, launches Playwright, navigates to the target React app, and performs an initial scan to understand the current UI.
2.  **MCP-User (LLM) Discovers Capabilities**:
    - MCP-User connects to the `react-cli-mcp` MCP server.
    - MCP-User calls a discovery mechanism (e.g., a standard MCP discovery endpoint or a specific tool like `get_server_capabilities`) to learn about the stable, generic tools (`get_current_screen_actions`, `get_current_screen_data`, `send_command`).
3.  **MCP-User Assesses Current Screen**:
    - MCP-User calls `get_current_screen_actions`. `react-cli-mcp` (via React App Parser) provides a dynamic list of possible actions (e.g., elements that can be clicked, inputs that can be filled) based on the currently visible UI in the React app. This response includes identifiers for elements and templates for commands.
    - MCP-User calls `get_current_screen_data`. `react-cli-mcp` provides a structured representation of the data currently displayed in elements marked for data display.
4.  **MCP-User Decides and Sends Command**:
    - Based on its goals and the information from `get_current_screen_actions` and `get_current_screen_data`, the MCP-User decides on an action.
    - MCP-User calls the `send_command` tool, providing parameters like the target element's identifier (obtained from `get_current_screen_actions`) and the specific action to perform (e.g., "click", or "type 'text'").
5.  **`react-cli-mcp` Executes Action**:
    - The MCP Integration Layer receives the `send_command` request.
    - The MCP Agent Core translates this into a Playwright action on the live React App (e.g., `page.locator('[data-interactive-element="some_id"]').click()`).
6.  **`react-cli-mcp` Observes Result & Updates State**:
    - The React app responds to the action (e.g., UI updates, data changes, navigation occurs).
    - `react-cli-mcp` (via Playwright and the React App Parser) observes these changes. If navigation occurs, it re-scans the new page view.
7.  **`react-cli-mcp` Responds to MCP-User**:
    - The MCP Integration Layer encodes the result (e.g., "Action successful", "Error: element not found", "Navigation to /new-page occurred") into an MCP response for the `send_command` call.
    - The response may also include a snapshot of critical updated data or suggest that the MCP-User call `get_current_screen_actions` / `get_current_screen_data` again to get a full picture of the new state.
8.  **Loop**: The MCP-User continues interacting by calling `get_current_screen_actions`/`get_current_screen_data` and `send_command` as needed.

## 3. React App Parser Details

- **Strategy**:
  - **Primary Method**: Utilize the `data-interactive-element` attribute for interactive components, and `data-display-container` / `data-display-item-text` (or similar) for elements that display data. The parser will scan the DOM (either live or a representation) for these attributes.
  - **Information to Extract**:
    - For interactive elements: Type (e.g., `button`, `input-text`, `checkbox`), current value/state (e.g., text in input, checked status), associated labels or accessible names.
    - For display elements: Type of data container (e.g., `list`, `item-details`), displayed text content, or structured representation of the data items.
    - Unique identifier (if available, or generate one based on structure/attributes).
  - **AST Parsing (Future Consideration)**: For more complex scenarios or for apps without these data attributes, AST parsing of React components could be explored. This would involve analyzing the component code itself. Initially, we will rely on the data attributes.
- **Output**: A structured representation of the interactive elements and their current state, usable by the CLI module.

## 4. CLI Generation & Interaction Module / MCP Agent Core

- **Interaction Model (via MCP)**:
  - The MCP-User (LLM) interacts with the React application through a small, stable set of generic MCP tools.
  - The core idea is that the `react-cli-mcp` tool dynamically discovers the capabilities of the _current view_ in the React app and presents these as _data_ to the MCP-User, rather than as a constantly changing set of MCP tools.
- **Generic MCP Tools Exposed**:
  - `get_current_screen_actions`:
    - No input parameters.
    - Returns: A structured list of currently available actions. Each action includes:
      - An identifier for the interactive element (e.g., derived from `data-interactive-element`).
      - The type of element (e.g., `button`, `input-text`, `link`).
      - A human-readable label (e.g., from element text, `aria-label`).
      - A template or structure indicating how to call `send_command` for this action.
  - `get_current_screen_data`:
    - No input parameters.
    - Returns: A structured representation of the data currently visible in elements marked with `data-display-container` and `data-display-item-text`.
  - `send_command`:
    - Input Parameters:
      - `target_element_id`: The identifier of the element to interact with (obtained from `get_current_screen_actions`).
      - `action_type`: The type of interaction (e.g., `click`, `type`, `toggle`).
      - `action_params` (optional): Additional parameters for the action (e.g., text to type for an `input-text` element).
    - Returns: Result of the action (e.g., success, failure, navigation details).
- **State Management**: The module needs to keep track of the current URL and potentially other high-level state of the React application to provide context. The primary source of truth for available actions and displayed data is always a fresh scan of the current Playwright page.

## 5. MCP Integration Layer

- **Message Structure**:
  - Define clear MCP message schemas for requests and responses for the generic tools:
    - `get_current_screen_actions` (request/response)
    - `get_current_screen_data` (request/response)
    - `send_command` (request/response)
  - Payloads will contain necessary parameters (e.g., for `send_command`: target element ID, action type, action parameters) and results (e.g., for `get_current_screen_actions`: list of actions; for `send_command`: success/failure, navigation details).
- **Context Management**: The MCP-User (LLM) primarily manages its own context by calling `get_current_screen_actions` and `get_current_screen_data` to understand the current state and possibilities of the React application. The server provides this information on demand.

## 6. Key Technologies & Tools

- **Language**: Node.js (TypeScript highly recommended for type safety and better development experience).
- **Web Interaction**: `Playwright` (has excellent Node.js API) for headless browser interaction with the React app.
- **Parsing (DOM)**: Direct DOM APIs via Playwright.
- **Parsing (AST - Future)**: Libraries like `@babel/parser`, `esprima`, or the TypeScript compiler API if we proceed with AST analysis.
- **Package Manager**: npm or yarn.
- **Server Framework (Optional, if react-cli-mcp runs as a persistent server)**: Express.js, Fastify, or similar Node.js frameworks.

## 7. Development Phases & Roadmap

- **Phase 3.1: Basic Parser & CLI for Todo App (Proof of Concept)**

  - **Task 3.1.1**: Setup project structure for `react-cli-mcp` (Node.js with TypeScript, npm/yarn, add Playwright dependency).
  - **Task 3.1.2**: Implement a simple parser that uses Playwright to launch the frontend app, find elements with `data-interactive-element` and `data-display-*` attributes.
  - **Task 3.1.3**: Implement functions to interact with these elements (click, type, get value/state).
  - **Task 3.1.4**: Create a basic CLI interpreter (not MCP yet) that can take simple commands (e.g., `add_todo "Buy groceries"`, `list_todos`) and execute them using the parser/interaction functions.
  - **Task 3.1.5**: Test thoroughly with the Todo app.

- **Phase 3.2: MCP Integration**

  - **Task 3.2.1**: Define MCP message schemas for requests and responses.
  - **Task 3.2.2**: Implement the MCP integration layer to wrap the CLI functionality.
  - **Task 3.2.3**: Set up a simple way to send MCP messages to the tool and receive responses (e.g., a basic client script).

- **Phase 3.3: Refinement & Generalization**

  - **Task 3.3.1**: Improve error handling and reporting.
  - **Task 3.3.2**: Enhance parser to extract more context (e.g., labels, surrounding text).
  - **Task 3.3.3**: Explore strategies for handling more complex UI structures or multi-step operations.
  - **Task 3.3.4**: Documentation.

- **Future Phases (Beyond initial scope)**:
  - Support for navigation between different views/pages.
  - More advanced state tracking.
  - AST-based parsing as an alternative or complement.
  - Support for other UI elements (selects, radio buttons, etc.).

## 8. Key Challenges & Risks

- **Complexity of React Apps**: Real-world React apps can be very complex, with nested components, various state management patterns (Redux, Zustand, Context API), and custom event handling. Relying purely on `data-*` attributes might be limiting.
- **State Synchronization**: Ensuring the LLM's understanding of the UI state matches the actual UI state.
- **Dynamic Content**: Handling dynamically loaded content or components that appear/disappear.
- **Mapping Natural Language to CLI**: If the LLM is to generate commands from natural language, this mapping can be non-trivial. (Though initially, the LLM might be prompted to use specific MCP formats).
- **Performance**: Headless browser interaction can be slower than direct API calls.
- **Identifying Actionable Elements**: While `data-interactive-element` helps, determining _what_ action is appropriate for an element (and what its parameters are) can still be challenging.

## 9. Open Questions

- How will `react-cli-mcp` be invoked? As a standalone server, or a library integrated into another system?
- How will the target React application URL be provided to `react-cli-mcp`?
- Security implications of allowing an LLM to interact with web applications.
- **State Synchronization**: Ensuring the MCP-User's understanding of the UI state matches the actual UI state. This is primarily addressed by the `get_current_screen_data` and `get_current_screen_actions` tools providing fresh information from the live application on each call. The onus is on the MCP-User to call these tools to refresh its understanding as needed, especially after actions that might change the UI.
- **Dynamic Content**: Handling dynamically loaded content or components that appear/disappear. The dynamic nature of `get_current_screen_actions` and `get_current_screen_data` (by re-scanning the live DOM via Playwright) is designed to handle this.
- **Mapping MCP-User Intent to Generic Commands**: The MCP-User needs to effectively use the output of `get_current_screen_actions` (which describes available operations) to correctly formulate the parameters for the `send_command` tool. This involves understanding the semantic meaning of the labels and identifiers provided.
- **Performance**: Headless browser interaction and frequent DOM scanning (especially for `get_current_screen_actions` and `get_current_screen_data`) can be resource-intensive and potentially slow. Optimizations might be needed (e.g., partial scans, caching if safe).
- **Defining Element Identifiers**: Ensuring that the identifiers derived (e.g., from `data-interactive-element`) are unique and stable enough across minor UI re-renders is important for the `send_command` tool to reliably target elements.

---

This plan provides a starting point. We can refine and add details as we progress.

---

## Progress Update (As of end of session)

**Last Completed Task (from Phase 3.1):**

- **Task 3.1.1**: Setup project structure for `react-cli-mcp` (Node.js with TypeScript, npm/yarn, add Playwright dependency).
  - Initialized Node.js project with `package.json`.
  - Installed TypeScript, `@types/node`, and `playwright`.
  - Created `tsconfig.json`.
  - Installed Playwright browser binaries.
  - Created `src/main.ts` and basic directory structure.
  - Added `build`, `start`, and `dev` scripts to `package.json`.
  - Created `.gitignore`.

**Next Task to Implement:**

- **Task 3.1.2**: Implement a simple parser in `src/main.ts` that uses Playwright to launch the frontend app, find elements with `data-interactive-element` attributes, and also find elements with `data-display-container` and `data-display-item-text` attributes. This forms the basis of the `React App Parser` component and is crucial for both `get_current_screen_actions` and `get_current_screen_data`.

  - **Task 3.1.3**: Implement functions in `src/main.ts` (or modules it uses) to programmatically interact with these identified elements (e.g., simulate click, type text, get current value/state, check visibility). These functions will be the core logic used by the `send_command` MCP tool.
  - **Task 3.1.4**: Create a basic command-line testing interface (not the final MCP server yet, but could be a simple Node.js script that uses `inquirer` or similar). This interface will allow manual testing of the generic command concepts:
    - A command to simulate `get_current_screen_actions` (should log the identified actions from the current page).
    - A command to simulate `get_current_screen_data` (should log the identified display data).
    - A command to simulate `send_command` (taking an element ID and action, then using the functions from 3.1.3 to execute it).
  - **Task 3.1.5**: Test these functions and the test interface thoroughly with the Todo app, including actions that cause UI updates and simple navigation if possible.

- **Phase 3.2: MCP Integration**

  - **Task 3.2.1**: Define MCP message schemas for requests and responses.
  - **Task 3.2.2**: Implement the MCP integration layer to wrap the CLI functionality.
  - **Task 3.2.3**: Set up a simple way to send MCP messages to the tool and receive responses (e.g., a basic client script).

- **Phase 3.3: Refinement & Generalization**

  - **Task 3.3.1**: Improve error handling and reporting.
  - **Task 3.3.2**: Enhance parser to extract more context (e.g., labels, surrounding text).
  - **Task 3.3.3**: Explore strategies for handling more complex UI structures or multi-step operations.
  - **Task 3.3.4**: Documentation.

- **Future Phases (Beyond initial scope)**:
  - Support for navigation between different views/pages.
  - More advanced state tracking.
  - AST-based parsing as an alternative or complement.
  - Support for other UI elements (selects, radio buttons, etc.).
