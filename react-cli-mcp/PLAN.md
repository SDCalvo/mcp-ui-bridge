# mcp-ui-bridge: Project Plan

## 1. Project Goal & Scope

- **Primary Goal**: To create a tool (`mcp-ui-bridge`) that enables a Large Language Model (LLM) to interact with web applications through a terminal-like interface using the Model Context Protocol (MCP).
- **Core Functionality**:
  - Parse a target web application to identify interactive elements and their functionalities.
  - Generate a Command Line Interface (CLI) representation of the web application's interactive parts.
  - Facilitate communication between the LLM and the web app via this CLI, using MCP for structured data exchange.
- **Initial Scope (Sample Todo App)**:
  - Successfully parse the existing Todo sample application.
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

The `mcp-ui-bridge` system will consist of the following main components:

- **Web App Parser (`DomParser`)**:
  - Responsible for analyzing the structure and interactive elements of the target web application using Playwright.
  - Identifies elements marked with various `data-mcp-*` attributes.
  - Extracts relevant information (type, current state, labels, associated actions, displayed text/data).
- **CLI Generation & Interaction Module / MCP Agent Core (`main.ts`, `PlaywrightController`)**:
  - This module is the heart of `mcp-ui-bridge`. It dynamically understands the current state of the web application via the `DomParser`.
  - Provides a command-line interface for interacting with the application.
  - Manages the state of the interaction, including the current "view" or context.
  - Executes actions on the web app using `PlaywrightController`, based on commands.
- **MCP Integration Layer (Future)**:
  - Will expose a stable set of generic MCP tools (e.g., `get_current_screen_actions`, `get_current_screen_data`, `send_command`).
  - Will format messages according to MCP.
- **Server/Runtime Environment**:
  - Hosts the `mcp-ui-bridge` tool.
  - Runs a headless or headed browser (Playwright) to interact with the web application.

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

1.  **Initialization**: `mcp-ui-bridge` starts, `PlaywrightController` launches Playwright, navigates to the target web app.
2.  **User Assesses Current Screen**:
    - The tool runs an initial scan using `DomParser` and displays available interactive elements, display containers, regions, etc. (`displayCurrentScreenState` in `main.ts`).
3.  **User Decides and Enters Command**:
    - User types a command (e.g., `click <id>`, `type <id> "text"`, `state <id>`, `scan`).
4.  **`mcp-ui-bridge` Executes Action**:
    - `main.ts` parses the command.
    - `PlaywrightController` methods execute the action (e.g., `clickElement`, `typeInElement`).
    - `getElementState` can be used to query specific element details.
5.  **`mcp-ui-bridge` Observes Result & Updates State**:
    - The web app responds.
    - The CLI typically re-scans or indicates that a `scan` might be needed to see the full effect of an action.
6.  **Loop**: User continues interacting.

## 3. Web App Parser Details (`DomParser`)

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

  - [x] **Task 3.3.1**: Define MCP Message Schemas
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
    - [x] Test end-to-end flows with the Todo app _(Successfully tested via local library usage)_
  - [ ] **Task 3.4.3**: Performance Testing
    - [ ] Measure response times for various operations
    - [ ] Test with different page complexities
    - [ ] Identify and address bottlenecks

- **Phase 3.5: Package as a Turnkey MCP Server/Tool**

  - **Goal**: Package the `mcp-ui-bridge` system into an easy-to-use tool. Developers can install and run this tool against their web application, which will automatically start the DOM parser, the MCP server (for LLM interaction), and optionally the interactive CLI (for debugging/direct use).

  - [x] **Task 3.5.1**: Create configurable entry points (CLI command, programmatic API).
    - [x] `runMcpServer(options: McpServerOptions)` provides a programmatic API.
    - [x] `src/main.ts` acts as a CLI entry point using environment variables.
  - [x] **Task 3.5.2**: Package for easy distribution (e.g., via npm).
    - [x] Configured `package.json` in `react-cli-mcp` for publishing as `mcp-ui-bridge`.
    - [x] Added `README.md` (for npm) and `LICENSE` file to `react-cli-mcp`.
    - [x] **Successfully published `mcp-ui-bridge@0.1.0` to npm.**
    - [x] **Tested by updating `mcp-external-server` to use the npm package, confirming functionality.**
  - [ ] **Task 3.5.3**: Improve documentation for tool usage and `data-mcp-*` attribute specification.
    - [x] Updated main `README.md` with detailed usage, `data-mcp-*` attributes, and `mcp-external-server` instructions.
    - [x] Updated `react-cli-mcp/README.md` (for npm) with comprehensive library usage details.

- **Phase 3.5.1 (was 3.6): MCP Server Client Authentication** (Moved and renumbered for clarity)
  - **Chosen Approach**: Custom user-defined asynchronous authentication callback.
    - [x] Added `authenticateClient?: (context: ClientAuthContext) => Promise<boolean>` to `McpServerOptions`.
    - [x] `ClientAuthContext` provides `headers` and `sourceIp`.
    - [x] Integrated with `FastMCP`'s `authenticate` option.
    - [x] If callback returns `false` or throws, FastMCP denies connection (401/500).
    - [x] `mcp-external-server` includes a toy implementation (`MANUALLY_ALLOW_CONNECTION`) for testing this.
    - [x] Successfully tested auth success and failure scenarios.

## 8. Key Challenges & Risks

(Content from original plan remains relevant)

## 9. Open Questions

(Content from original plan remains relevant)

---

## 10. Recent Progress & Next Steps (As of 2024-05-17)

**Recently Completed (Updated on 2024-05-21):**

- **Functional MCP Server Implementation (`Phase 3.3`):**

  - Successfully refactored `src/mcp_server.ts` to be a fully functional MCP server using `FastMCP` (TypeScript version).
  - Integrated `PlaywrightController` to manage browser instances and interactions.
  - Integrated `DomParser` to analyze the live DOM of the target web application based on `data-mcp-*` attributes.
  - The `get_current_screen_data` tool now correctly fetches and returns structured data and interactive elements from the live web page.
  - The `get_current_screen_actions` tool now correctly derives actionable commands and hints from the interactive elements.
  - The `get_page_screenshot` tool was implemented to capture page screenshots as base64 strings, but it is currently not exposed via the MCP server as the LLM cannot directly interpret images. The code for this tool remains available.
  - The `send_command` tool can now parse `click #id` and `type #id "text"` commands, execute them using `PlaywrightController`, and return the action's outcome.
  - The server correctly launches Playwright, navigates to the target URL (configurable via `MCP_TARGET_URL` or `McpServerOptions`), and handles basic interactions.
  - Tested end-to-end flow: MCP client calls tools -> MCP server interacts with web app via Playwright -> web app state changes -> MCP server reports new state.
  - **Type Definition Consolidation:** Moved all type definitions from `src/core/types.ts` to `src/types/index.ts` and updated all import paths. Deleted `src/core/types.ts`.
  - **Verified MCP Tool Functionality:** Confirmed `get_current_screen_data`, `get_current_screen_actions`, and `send_command` (click, type) are working correctly after type refactoring and before library packaging. Successfully deleted all existing todos and added a new one.

- **Library Packaging & Local Testing (`Phase 3.5` initiated):**
  - **`tsconfig.json` Updates (`Task 3.4.3`):** Added `declaration: true`, `declarationMap: true`, `sourceMap: true` to enable generation of type definition files for library consumers.
  - **`package.json` Updates (`Task 3.4.2`):**
    - Set `name` to `react-cli-mcp`.
    - Set `main` to `dist/mcp_server.js` and `types` to `dist/mcp_server.d.ts`.
    - Added `files` array to include `dist`, `README.md`, and `LICENSE`.
    - Added `keywords`, `author`, and `description`.
    - Updated `build` script to `npm run clean && tsc`.
    - Ensured `clean` script correctly removes the `dist` directory.
  - **README Creation (`Task 3.4.4`):** Created a dedicated `react-cli-mcp/README.md` file with:
    - Project overview.
    - Features.
    - Installation instructions (as a library).
    - Programmatic usage example (importing `runMcpServer` and `McpServerOptions`).
    - Configuration options for `McpServerOptions`.
    - Instructions on how to run the example (pointing to the test frontend scenario).
  - **Local Testing as a Library:**
    - Successfully built `react-cli-mcp` using `npm run build`.
    - Used `npm link` in `react-cli-mcp` and then `npm link react-cli-mcp` in the `frontend` test project.
    - **Alternative Linking:** Successfully switched to using `file:../react-cli-mcp` in `frontend/package.json`'s `devDependencies` and ran `npm install` for a more stable local dependency setup.
    - Created `frontend/scripts/launch-mcp.ts` to programmatically import and run `react-cli-mcp` using `runMcpServer` with specific options.
    - Added `start-mcp-agent` script to `frontend/package.json` (`npx tsx ./scripts/launch-mcp.ts`).
    - Resolved TypeScript configuration issues in `frontend/tsconfig.node.json` (module resolution, includes) and type import issues (`verbatimModuleSyntax`) in `launch-mcp.ts`.
    - **Successfully tested all MCP tools** (`get_current_screen_data`, `get_current_screen_actions`, `send_command`) using the `frontend` project's `start-mcp-agent` script, confirming the library works as intended when imported and used by another project. The MCP agent connected via Cursor used the server instance started by `launch-mcp.ts`.

**Potential Next Steps:**

1.  **Refine Error Handling & Robustness in MCP Tools:**
    - Further improve error reporting from tools, ensuring consistent error structures and types.
    - Handle more edge cases in `send_command` parsing or Playwright interactions.
2.  **Expand `send_command` Capabilities:**
    - Consider adding support for other actions (e.g., `select #id "value"`, `scroll #id`, `hover #id`, `state #id` as a command if distinct from `getElementState` which is internal).
    - Improve parsing for more complex parameters if needed.
3.  **MCP Test Client (`Task 3.3.3` - was previously under Phase 3.3):**
    - Develop a simple, dedicated MCP client script for more streamlined testing of the server, beyond the interactive tool usage here. This would help in automating test sequences.
4.  **Formalize MCP Message Schemas (`Task 3.3.1` - was previously under Phase 3.3):**
    - While FastMCP handles schema generation for tool parameters, consider documenting or even generating/exposing JSON schemas for the _return values_ of `get_current_screen_data` and `get_current_screen_actions` for client-side validation and type generation.
5.  **Begin Unit and Integration Testing (`Phase 3.4`):**
    - Start writing unit tests for the `DomParser` logic (especially attribute/label/type inference).
    - Write unit tests for `PlaywrightController` methods (these might be more like integration tests depending on how they are mocked).
    - Write integration tests for the MCP server tools, possibly using the test client mentioned above.
6.  **Address `main.ts` (Original CLI):**
    - The `PLAN.md` mentions `main.ts` as the previous CLI entry point. Decide on its future:
      - Will it be deprecated in favor of only the MCP server and library usage?
      - Will it be updated to _use_ the MCP server as a client for local CLI interaction/debugging (using the library itself)?
      - Or, will the `mcp_server.ts` (when run directly via Node, if that's desired) become the sole entry point for the tool if a direct CLI executable is still needed, perhaps with a command-line flag to enable an interactive diagnostic mode? _(Currently `src/main.ts` is the entry for `npm run start` and correctly uses `runMcpServer` from `mcp_server.ts`)_. Consider if `src/main.ts` is still the best name/place if the project is primarily a library.
7.  **TSDoc and API Documentation (`Task 3.4.4` refinement):**
    - Enhance TSDoc comments for all exported functions and types in `react-cli-mcp` for better auto-generated documentation (e.g., using TypeDoc).
8.  **Configuration Improvements for Library Usage:**
    - Ensure `McpServerOptions` is comprehensive for library users.
    - Review default behaviors and error handling when used as a library.
9.  **CLI Entry Point (`Task 3.4.2` - `bin` field):**
    - Revisit if a global CLI command (e.g., `npx react-cli-mcp start --url ...`) is still desired in addition to the programmatic library usage. If so, implement the `bin` in `package.json` and a CLI argument parsing mechanism in `src/main.ts` or a dedicated CLI entry point script.
10. **Publish to npm (`Task 3.4.5`):**
    - Once further testing and documentation are complete, consider publishing to npm.

---
