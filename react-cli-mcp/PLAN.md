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
- **CLI Generation & Interaction Module**:
  - Translates the parsed React app structure into a set of CLI commands or an interactive session.
  - Manages the state of the CLI interaction.
  - Executes actions on the React app based on CLI commands.
- **MCP Integration Layer**:
  - Formats messages (requests from LLM, responses from the tool) according to the Model Context Protocol.
  - Handles the lifecycle of an MCP interaction.
- **Server/Runtime Environment**:
  - Hosts the `react-cli-mcp` tool.
  - Potentially runs a headless browser or similar environment to interact with the React application if direct DOM manipulation/event simulation is needed.

**High-Level Flow:**

1.  LLM sends an MCP request (e.g., "list todos", "add todo 'Buy milk'").
2.  MCP Integration Layer receives and decodes the request.
3.  CLI Interaction Module translates the request into an action for the React app.
4.  React App Parser provides context/selectors for the action.
5.  Action is performed on the React App (e.g., simulating a button click, typing into an input). This might involve:
    - Directly manipulating a live React app (if running in a shared context).
    - Interacting with a headless browser instance running the React app.
6.  Result/updated state from the React app is observed.
7.  CLI Interaction Module formats the result.
8.  MCP Integration Layer encodes the result into an MCP response.
9.  Response is sent back to the LLM.

## 3. React App Parser Details

- **Strategy**:
  - **Primary Method**: Utilize the `data-interactive-element` attribute for interactive components, and `data-display-container` / `data-display-item-text` (or similar) for elements that display data. The parser will scan the DOM (either live or a representation) for these attributes.
  - **Information to Extract**:
    - For interactive elements: Type (e.g., `button`, `input-text`, `checkbox`), current value/state (e.g., text in input, checked status), associated labels or accessible names.
    - For display elements: Type of data container (e.g., `list`, `item-details`), displayed text content, or structured representation of the data items.
    - Unique identifier (if available, or generate one based on structure/attributes).
  - **AST Parsing (Future Consideration)**: For more complex scenarios or for apps without these data attributes, AST parsing of React components could be explored. This would involve analyzing the component code itself. Initially, we will rely on the data attributes.
- **Output**: A structured representation of the interactive elements and their current state, usable by the CLI module.

## 4. CLI Generation & Interaction Module

- **Interaction Model**:
  - Could be command-based (e.g., `todo add "text"`, `todo toggle 1`, `todo list`) or more conversational.
  - Needs to map LLM intent to specific UI interactions.
- **Available Commands (Todo App Example)**:
  - `list_todos`: Displays current todos (retrieved from elements marked for data display).
  - `add_todo <content>`: Creates a new todo.
  - `update_todo <todo_id> --completed <true|false>`: Toggles a todo's status.
  - `delete_todo <todo_id>`: Deletes a todo.
  - `get_element_state <element_id_or_selector>`: Gets the state of a specific element (could be interactive or display).
  - `input_text <element_id_or_selector> <text>`: Enters text into an input field.
  - `click_element <element_id_or_selector>`: Simulates a click on an element.
- **State Management**: The module needs to keep track of the "current view" or context of the interaction, including readily available displayed data.

## 5. MCP Integration Layer

- **Message Structure**:
  - Define clear MCP message types for requests (e.g., `ExecuteCommand`, `GetUIState`) and responses (`CommandResult`, `UIStateSnapshot`, `Error`).
  - Payloads will contain command details, arguments, and results.
- **Context Management**: How context (e.g., available commands, current UI state) is passed to the LLM.

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

- **Task 3.1.2**: Implement a simple parser in `src/main.ts` that uses Playwright to:
  1.  Launch a browser (Chromium by default).
  2.  Navigate to the frontend application (e.g., `http://localhost:5173`).
  3.  Find all elements with the `data-interactive-element` attribute.
  4.  Find all elements with `data-display-container` and `data-display-item-text` attributes.
  5.  For now, log basic information about these elements (e.g., tag name, attributes, text content) to the console.
