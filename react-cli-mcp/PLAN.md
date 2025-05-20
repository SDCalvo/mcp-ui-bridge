# react-cli-mcp: Project Plan

## 1. Project Goal & Scope

- **Primary Goal**: To create a tool (`react-cli-mcp`) that enables a Large Language Model (LLM) to interact with React-based web applications through a terminal-like interface using the Model Context Protocol (MCP).
- **Core Functionality**:
  - Parse a target React application to identify interactive elements and their functionalities.
  - Generate a Command Line Interface (CLI) representation of the React application's interactive parts.
  - Facilitate communication between the LLM and the React app via this CLI, using MCP for structured data exchange.
- **Initial Scope (Todo App)**:
  - Successfully parse the existing Todo React application.
  - Identify interactive elements (input fields, buttons, checkboxes) based on `data-mcp-*` attributes.
  - Identify data display areas (e.g., lists of items, item content) based on `data-mcp-*` attributes.
  - Expose actions like:
    - Adding a new todo.
    - Marking a todo as complete/incomplete.
    - Deleting a todo.
    - Listing current todos.
- **Out of Scope (Initially)**:
  - Complex navigation beyond simple views.
  - Visual understanding of the UI (focus is on semantic interaction via attributes).

## 2. Core Components & High-Level Architecture

The `react-cli-mcp` system will consist of the following main components:

- **React App Parser (`DomParser`)**:
  - Responsible for analyzing the structure and interactive elements of the target React application using Playwright.
  - Identifies elements marked with various `data-mcp-*` attributes.
  - Extracts relevant information (type, current state, labels, associated actions, displayed text/data).
- **CLI Generation & Interaction Module / MCP Agent Core (`main.ts`, `PlaywrightController`)**:
  - This module is the heart of `react-cli-mcp`. It dynamically understands the current state of the React application via the `DomParser`.
  - Provides a command-line interface for interacting with the application.
  - Manages the state of the interaction, including the current "view" or context.
  - Executes actions on the React app using `PlaywrightController`, based on commands.
- **MCP Integration Layer (Future)**:
  - Will expose a stable set of generic MCP tools (e.g., `get_current_screen_actions`, `get_current_screen_data`, `send_command`).
  - Will format messages according to MCP.
- **Server/Runtime Environment**:
  - Hosts the `react-cli-mcp` tool.
  - Runs a headless or headed browser (Playwright) to interact with the React application.

### 2.1. Data Attributes for MCP Interaction

To establish a clear and stable contract, specific `data-mcp-*` attributes are used. These are defined in `src/types/attributes.ts`.

**Core Attributes Defined and Used:**

- `data-mcp-interactive-element="unique-id"`: Identifies elements the user can interact with. Value is its unique ID.
- `data-mcp-display-container="unique-id"`: Marks a container for display items.
- `data-mcp-display-item-text`: Marks an element whose text content is the primary display text of an item.
- `data-mcp-element-label="Descriptive Label"`: Explicit human-readable label for an element.
- `data-mcp-element-type="button | text-input | checkbox"`: Explicitly defines the type/role (primarily for overriding or clarifying). Parser infers if not present.
- `data-mcp-navigates-to="url-or-view-id"`: Indicates destination if interaction causes navigation.
- `data-mcp-value="current-value"`: (Planned/Available) Explicitly provides the value of an element if hard to infer.
- `data-mcp-display-item-id="unique-item-id"`: Unique ID for a specific item in a display container.
- `data-mcp-purpose="Description of what the element/container does"`: Semantic hint.
- `data-mcp-group="group-name"`: Groups related interactive elements.
- `data-mcp-controls="element-id"`: ID of an element that this element controls (ARIA-like).
- `data-mcp-updates-container="container-id"`: ID of a display container this element updates.
- `data-mcp-region="region-name"`: Defines a logical region on the page.
- `data-mcp-disabled="true|false"`: Explicitly sets the disabled state. Overrides inferred state.
- `data-mcp-readonly="true|false"`: Explicitly sets the readonly state. Overrides inferred state.
- `data-mcp-loading-indicator-for="element-id-or-region-name"`: Marks an element as a loading indicator for another part.
- `data-mcp-status-message-container="unique-id"`: Marks an area where status messages appear.
- `data-mcp-field="field-name"`: Within a display item, marks specific named pieces of data.

**Parser Inferrence Strategy:**
The `DomParser` currently:

- Infers element type from tag name and attributes (e.g., `input[type="checkbox"]`).
- Infers labels from `aria-label`, `textContent`, `placeholder`, falling back to ID.
- Infers `disabled`/`readonly` states from DOM properties if not explicitly set by `data-mcp-disabled`/`data-mcp-readonly`.
- Extracts `value` from input elements.

### High-Level Flow (Current CLI - to be adapted for MCP):

1.  **Initialization**: `react-cli-mcp` starts, `PlaywrightController` launches Playwright, navigates to the target React app.
2.  **User Assesses Current Screen**:
    - The tool runs an initial scan using `DomParser` and displays available interactive elements, display containers, regions, etc. (`displayCurrentScreenState` in `main.ts`).
3.  **User Decides and Enters Command**:
    - User types a command (e.g., `click <id>`, `type <id> "text"`, `state <id>`, `scan`).
4.  **`react-cli-mcp` Executes Action**:
    - `main.ts` parses the command.
    - `PlaywrightController` methods execute the action (e.g., `clickElement`, `typeInElement`).
    - `getElementState` can be used to query specific element details.
5.  **`react-cli-mcp` Observes Result & Updates State**:
    - The React app responds.
    - The CLI typically re-scans or indicates that a `scan` might be needed to see the full effect of an action.
6.  **Loop**: User continues interacting.

## 3. React App Parser Details (`DomParser`)

- **Strategy**:
  - **Primary Method**: Utilizes the `data-mcp-*` attributes listed in Section 2.1. The parser scans the live DOM via Playwright.
  - **Information Extracted**: As defined in `src/types/index.ts` (e.g., `InteractiveElementInfo`, `DisplayContainerInfo`, etc.), including IDs, types, labels, values/states, purposes, and relationships.
- **Output**: Arrays of structured info objects (e.g., `InteractiveElementInfo[]`).

## 4. CLI Generation & Interaction Module (`main.ts`, `PlaywrightController`)

- **Interaction Model (Current CLI)**:
  - User interacts via text commands in a loop.
  - `main.ts` uses `inquirer` for input.
  - Output is logged to the console.
- **Implemented Commands**:
  - `scan`: Re-scans the page and displays current state (interactive elements, display containers, etc.).
  - `click <elementId>`: Clicks the specified interactive element.
  - `type <elementId> "<text>"`: Types text into the specified interactive element.
  - `state <elementId>`: Displays detailed state information for a specific interactive element.
  - `quit`: Exits the tool.
- **State Management**: `PlaywrightController` maintains the browser and page. `DomParser` always performs a fresh scan.

## 5. MCP Integration Layer (Future)

- **Message Structure**:
  - Define clear MCP message schemas for requests and responses.
- **Adapt CLI to MCP**:
  - The generic tools concept (`get_current_screen_actions`, `get_current_screen_data`, `send_command`) will be implemented here, using the underlying `DomParser` and `PlaywrightController` functionality.

## 6. Key Technologies & Tools

- **Language**: Node.js with TypeScript.
- **Web Interaction**: `Playwright`.
- **Parsing (DOM)**: Direct DOM APIs via Playwright, orchestrated by `DomParser`.
- **CLI Input**: `inquirer`.
- **Package Manager**: npm.

## 7. Development Phases & Roadmap

- **Phase 3.1: Core Parser, Controller & Basic CLI (Proof of Concept)**

  - **Task 3.1.1**: Project Setup
    - [x] Initialize Node.js project (`npm init -y`).
    - [x] Install TypeScript and `@types/node` (`npm install typescript @types/node --save-dev`).
    - [x] Create `tsconfig.json`.
    - [x] Install `playwright` and `inquirer`.
    - [x] Run `npx playwright install` for browser binaries.
    - [x] Create `src/main.ts`, `src/core/playwright-controller.ts`, `src/core/dom-parser.ts`, `src/types/index.ts`, `src/types/attributes.ts`.
    - [x] Add scripts to `package.json` (build, start, dev).
    - [x] Create `.gitignore`.
  - **Task 3.1.2**: Implement `PlaywrightController` (`src/core/playwright-controller.ts`)
    - [x] Launch/close browser and page.
    - [x] Navigate to URL.
    - [x] Basic interaction methods: `clickElement(elementId)`, `typeInElement(elementId, text)`.
    - [x] Element state retrieval: `getElementState(elementId)`.
  - **Task 3.1.3**: Implement `DomParser` (`src/core/dom-parser.ts`)
    - [x] Find interactive elements (`data-mcp-interactive-element`) and extract `InteractiveElementInfo`.
    - [x] Find display containers (`data-mcp-display-container`), items (`data-mcp-display-item-text`), and fields (`data-mcp-field`) extracting `DisplayContainerInfo`.
    - [x] Find page regions (`data-mcp-region`) extracting `PageRegionInfo`.
    - [x] Find status messages (`data-mcp-status-message-container`) extracting `StatusMessageAreaInfo`.
    - [x] Find loading indicators (`data-mcp-loading-indicator-for`) extracting `LoadingIndicatorInfo`.
    - [x] Helper functions for attribute fetching, label/type inference.
  - **Task 3.1.4**: Implement TypeScript types and attribute constants
    - [x] Define interfaces in `src/types/index.ts` (`InteractiveElementInfo`, `DisplayContainerInfo`, etc.).
    - [x] Define attribute constants in `src/types/attributes.ts`.
  - **Task 3.1.5**: Create Basic CLI (`src/main.ts`)
    - [x] Initialize `PlaywrightController` and `DomParser`.
    - [x] Implement command loop using `inquirer`.
    - [x] Implement `scan` command (using `displayCurrentScreenState` which calls all `DomParser` find methods).
    - [x] Implement `click <id>` command.
    - [x] Implement `type <id> "<text>"` command.
    - [x] Implement `state <id>` command.
    - [x] Implement `quit` command.
    - [x] Basic console logging for output.
  - **Task 3.1.6**: Initial Testing with Todo App
    - [x] Manually tested current CLI commands with the frontend Todo application.

- **Phase 3.2: Refinement & Robustness**

  - [x] **Task 3.2.1**: Enhance `DomParser` and `PlaywrightController`
    - [x] Ensure full coverage of defined `data-mcp-*` attributes (element-type, element-state, value successfully tested).
    - [x] Improve error handling, logging, and edge case management (Implemented `ActionResult`, `ParserResult`, better error categorization and messages, including retry suggestions for timeouts).

- **Phase 3.3: MCP Integration**

  - [ ] **Task 3.3.1**: Define MCP Message Schemas
    - [ ] Draft JSON schemas for `get_current_screen_actions`, `get_current_screen_data`, `send_command` (requests & responses). _(Partially addressed by structuring tool return JSON; formal schemas for client validation TBD)_
  - [x] **Task 3.3.2**: Implement MCP Layer
    - [x] Create modules/classes for handling MCP communication. _(Achieved by refactoring `mcp_server.ts` into a configurable module)_
    - [x] Adapt the `main.ts` logic or create a new entry point to act as an MCP server. _(New `mcp_server.ts` provides `runMcpServer`, and `src/main.ts` now correctly uses it as the entry point for `npm run start`)_
    - [x] Map `DomParser` output to `get_current_screen_actions` and `get_current_screen_data` responses. _(Implemented and successfully tested end-to-end)_
    - [x] Map `send_command` requests to `PlaywrightController` actions. _(Implemented for `click` and `type`, and successfully tested end-to-end including adding and deleting items)_

- **Phase 3.4: Testing & Validation**

  - [ ] **Task 3.4.1**: Unit Testing
    - [ ] Write unit tests for parser logic
    - [ ] Write unit tests for PlaywrightController
    - [ ] Write unit tests for MCP message handling
  - [ ] **Task 3.4.2**: Integration Testing
    - [ ] Test CLI functionality
    - [ ] Test MCP server functionality
    - [ ] Test end-to-end flows with the Todo app
  - [ ] **Task 3.4.3**: Performance Testing
    - [ ] Measure response times for various operations
    - [ ] Test with different page complexities
    - [ ] Identify and address bottlenecks

- **Phase 3.5: Package as a Turnkey MCP Server/Tool**

  - **Goal**: Package the `react-cli-mcp` system into an easy-to-use tool. Developers can install and run this tool against their React application, which will automatically start the DOM parser, the MCP server (for LLM interaction), and optionally the interactive CLI (for debugging/direct use).

  - [ ] **Task 3.4.1**: Create Configurable Entry Points & Core Abstraction

    - [ ] Define clear entry points for starting the system (e.g., a primary CLI command like `npx react-cli-mcp connect --url <app-url>` and/or a simple programmatic function like `runMcpServer({targetUrl: '<app-url>'})`).
    - [ ] Abstract the core application logic (Playwright launching, DOM parsing, MCP server startup, CLI loop) into a primary class or module that can be invoked by these entry points.
    - [ ] Implement configuration options (e.g., target URL, headless mode, MCP server port, enable/disable interactive CLI mode) passable via CLI arguments or function parameters.
    - [ ] Ensure the MCP server component can be started and run independently of the interactive `inquirer`-based CLI prompt, allowing for server-only operation.

  - [ ] **Task 3.4.2**: Configure `package.json` for Distribution

    - [ ] Set `bin` field for CLI command(s).
    - [ ] Set `main`, `module`, and `types` fields to point to appropriate library entry points if a programmatic API is also offered.
    - [ ] Define `files` to include necessary distributable files (compiled JS, type definitions).
    - [ ] Add relevant metadata (keywords, author, license, repository URL, description).

  - [ ] **Task 3.4.3**: Build Process for Distributable Tool

    - [ ] Ensure `tsc` build process in `tsconfig.json` and `package.json` scripts correctly compiles the project for distribution, including generating necessary declaration files.
    - [ ] Verify the build output works as expected when installed/run in a different project.

  - [ ] **Task 3.4.4**: Tool Usage Documentation

    - [ ] Update `README.md` with clear instructions on how to install and run the `react-cli-mcp` tool against a React application.
    - [ ] Document all CLI commands, options, and any programmatic API if offered.
    - [ ] Provide examples of how to connect an MCP client to the server started by the tool.
    - [ ] Add TSDoc comments to any programmatically exposed functions/classes for auto-generated API documentation (e.g., using TypeDoc) if applicable.

  - [ ] **Task 3.4.5**: (Optional) Publish to npm
    - [ ] If intended for public use, prepare for and publish the package to the npm registry.
    - [ ] Set up npm scripts for versioning and publishing.

- **Phase 3.5: Deployment & Production Considerations**

  - **Goal**: Ensure `react-cli-mcp` can be reliably and securely used with deployed web applications, addressing challenges like authentication, network conditions, and headless operation.

  - [ ] **Task 3.5.1**: Strategy for Authentication/Authorization
    - [ ] Research and define mechanisms for `react-cli-mcp` to handle application logins (e.g., enabling LLM-driven login via `data-mcp-*` annotated forms).
    - [ ] Document security best practices for handling credentials.
    - [ ] Consider flows where the application might already have an active session if `react-cli-mcp` attaches to an existing authenticated browser context (advanced).
  - [ ] **Task 3.5.2**: Robustness for Deployed Environments
    - [ ] Implement configurable timeouts and retry mechanisms for Playwright actions to handle network latency.
    - [ ] Enhance error reporting for network issues, unexpected application states, or element-not-found scenarios common in dynamic deployed apps.
    - [ ] Thoroughly test and ensure stability of all core functionalities in headless browser mode.
  - [ ] **Task 3.5.3**: Session Management & State Persistence
    - [ ] Investigate strategies for handling long-lived interactions and potential session expiry/re-authentication.
    - [ ] Explore if/how `react-cli-mcp` might need to persist or restore interaction state across tool restarts when targeting a deployed app (e.g., current URL, basic context).
  - [ ] **Task 3.5.4**: Configuration for Deployed Targets
    - [ ] Ensure CLI options or configuration files robustly handle various deployment URLs (HTTPS, ports, paths).
    - [ ] Consider parameters for proxies or specific browser launch arguments needed for certain deployed environments.
  - [ ] **Task 3.5.5**: Security Audit and Hardening
    - [ ] Review potential security vulnerabilities (e.g., command injection if not careful with how LLM inputs are translated to actions, unintended data exposure).
    - [ ] Implement safeguards or clear warnings related to interacting with sensitive data or critical functionalities in a deployed app.
    - [ ] Document secure operational practices for users.
  - [ ] **Task 3.5.6**: Documentation for Production/Deployed Use Cases
    - [ ] Create comprehensive documentation detailing how to set up and use `react-cli-mcp` against production or staging environments.
    - [ ] Include examples and best practices for authentication, handling dynamic content, and troubleshooting common issues in deployed settings.

- **Future Phases (Beyond initial scope)**:
  - Support for complex navigation and state tracking.
  - AST-based parsing as a complementary approach.
  - Advanced error recovery and retries.
  - Comprehensive documentation.

## 8. Key Challenges & Risks

(Content from original plan remains relevant)

## 9. Open Questions

(Content from original plan remains relevant)

---

## 10. Recent Progress & Next Steps (As of 2024-05-17)

**Recently Completed:**

- **Functional MCP Server Implementation (`Phase 3.3`):**
  - Successfully refactored `src/mcp_server.ts` to be a fully functional MCP server using `FastMCP` (TypeScript version).
  - Integrated `PlaywrightController` to manage browser instances and interactions.
  - Integrated `DomParser` to analyze the live DOM of the target React application based on `data-mcp-*` attributes.
  - The `get_current_screen_data` tool now correctly fetches and returns structured data and interactive elements from the live web page.
  - The `get_current_screen_actions` tool now correctly derives actionable commands and hints from the interactive elements.
  - The `send_command` tool can now parse `click #id` and `type #id "text"` commands, execute them using `PlaywrightController`, and return the action's outcome.
  - The server correctly launches Playwright, navigates to the target URL (configurable via `MCP_TARGET_URL`), and handles basic interactions.
  - Tested end-to-end flow: MCP client calls tools -> MCP server interacts with React app via Playwright -> React app state changes -> MCP server reports new state.

**Potential Next Steps:**

1.  **Refine Error Handling & Robustness in MCP Tools:**
    - Further improve error reporting from tools, ensuring consistent error structures and types.
    - Handle more edge cases in `send_command` parsing or Playwright interactions.
2.  **Expand `send_command` Capabilities:**
    - Consider adding support for other actions (e.g., `select #id "value"`, `scroll #id`, `hover #id`, `state #id` as a command if distinct from `getElementState` which is internal).
    - Improve parsing for more complex parameters if needed.
3.  **MCP Test Client (`Task 3.3.3`):**
    - Develop a simple, dedicated MCP client script for more streamlined testing of the server, beyond the interactive tool usage here. This would help in automating test sequences.
4.  **Formalize MCP Message Schemas (`Task 3.3.1`):**
    - While FastMCP handles schema generation for tool parameters, consider documenting or even generating/exposing JSON schemas for the _return values_ of `get_current_screen_data` and `get_current_screen_actions` for client-side validation and type generation.
5.  **Begin Unit and Integration Testing (`Phase 3.4`):**
    - Start writing unit tests for the `DomParser` logic (especially attribute/label/type inference).
    - Write unit tests for `PlaywrightController` methods (these might be more like integration tests depending on how they are mocked).
    - Write integration tests for the MCP server tools, possibly using the test client mentioned above.
6.  **Address `main.ts` (Original CLI):**
    - The `PLAN.md` mentions `main.ts` as the previous CLI entry point. Decide on its future:
      - Will it be deprecated in favor of only the MCP server?
      - Will it be updated to _use_ the MCP server as a client for local CLI interaction/debugging?
      - Or, will the `mcp_server.ts` become the sole entry point for the tool, perhaps with a command-line flag to enable an interactive diagnostic mode? (This aligns with `Phase 3.5, Task 3.4.1`).
7.  **Documentation (`Task 3.4.4`):**
    - Start documenting how to run the MCP server and connect a generic MCP client to it.
    - Document the expected `data-mcp-*` attributes for React app developers.
8.  **Configuration Improvements:**
    - Consider a configuration file (e.g., JSON or YAML) for server settings (target URL, port, headless mode, timeouts) as an alternative or supplement to environment variables for easier management.

---
