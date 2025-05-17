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

  - [ ] **Task 3.2.1**: Enhance `DomParser` and `PlaywrightController`
    - [ ] More sophisticated error handling and logging in parser and controller methods.
    - [ ] Handle edge cases (e.g., missing attributes, elements appearing/disappearing during parsing).
    - [ ] Implement parsing for any remaining `data-mcp-*` attributes if not fully covered (e.g. `data-mcp-value` if distinct from input.value).
    - [ ] Consider if `data-mcp-element-state` needs specific handling beyond disabled/readonly/checked.
  - [ ] **Task 3.2.2**: CLI Enhancements
    - [ ] Improve output formatting (e.g., clearer tables, more structured JSON output option).
    - [ ] Add configuration options (headless mode toggle, target URL via arg/env).
    - [ ] Consider more interaction commands if needed (e.g., `toggle <id>`, `select <id> <value>`).
  - [ ] **Task 3.2.3**: Formal Testing
    - [ ] Develop unit tests for `DomParser` helper functions (label/type inference).
    - [ ] Develop basic integration tests for CLI commands interacting with a controlled sample HTML page.

- **Phase 3.3: MCP Integration**

  - [ ] **Task 3.3.1**: Define MCP Message Schemas
    - [ ] Draft JSON schemas for `get_current_screen_actions`, `get_current_screen_data`, `send_command` (requests & responses).
  - [ ] **Task 3.3.2**: Implement MCP Layer
    - [ ] Create modules/classes for handling MCP communication.
    - [ ] Adapt the `main.ts` logic or create a new entry point to act as an MCP server.
    - [ ] Map `DomParser` output to `get_current_screen_actions` and `get_current_screen_data` responses.
    - [ ] Map `send_command` requests to `PlaywrightController` actions.
  - [ ] **Task 3.3.3**: MCP Test Client
    - [ ] Create a simple script or use an MCP client tool to send test messages to the `react-cli-mcp` server.

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

## Progress Update (Reflects current state after review)

**Current Phase: End of 3.1 (Core Parser, Controller & Basic CLI) / Beginning of 3.2 (Refinement & Robustness)**

**Completed Tasks:**

- **Task 3.1.1**: Project Setup (Node.js, TypeScript, Playwright, Inquirer, structure).
- **Task 3.1.2**: `PlaywrightController` implementation (launch, navigate, click, type, get_state).
- **Task 3.1.3**: `DomParser` implementation (parsing for interactive elements, display containers, items, fields, regions, status messages, loading indicators, with attribute/label/type inference).
- **Task 3.1.4**: TypeScript types (`src/types/index.ts`) and attribute constants (`src/types/attributes.ts`) defined.
- **Task 3.1.5**: Basic CLI in `src/main.ts` (scan, click, type, state, quit commands using inquirer).
- **Task 3.1.6**: Initial manual testing with the Todo app.

**Next Tasks (Phase 3.2: Refinement & Robustness):**

- **Task 3.2.1**: Enhance `DomParser` and `PlaywrightController`:
  - Improve error handling, logging, and edge case management.
  - Ensure full coverage of defined `data-mcp-*` attributes.
- **Task 3.2.2**: CLI Enhancements:
  - Improve output formatting.
  - Add configuration options.
- **Task 3.2.3**: Formal Testing:
  - Unit tests for parser logic.
  - Integration tests for CLI.

Following this, we will proceed to **Phase 3.3: MCP Integration**.
