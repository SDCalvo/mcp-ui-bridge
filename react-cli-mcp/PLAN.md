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
  - [x] **Task 3.5.3**: Improve documentation for tool usage and `data-mcp-*` attribute specification.
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

- **Phase 3.6: Extensibility for Custom `data-mcp-*` Attributes and Handlers**

  - **Goal**: Allow users of `mcp-ui-bridge` (especially when used as a library) to define their own custom `data-mcp-*` attributes for data extraction and, in later stages, custom action handlers and parsing logic.
  - **Approach**: A phased approach, starting with custom data extraction, then moving to custom action handling, and finally to more advanced parser customizations.

  - **Sub-Phase 3.6.1: Custom Data Extraction**

    - **Task 3.6.1.1**: Define `CustomAttributeReader` and Update `McpServerOptions`
      - [x] In `src/types/index.ts`:
        - [x] Define `CustomAttributeReader` interface:
          ```typescript
          export interface CustomAttributeReader {
            attributeName: string; // e.g., "data-mcp-priority"
            outputKey: string; // Key for InteractiveElementInfo.customData
            processValue?: (
              attributeValue: string | null,
              elementHandle?: import("playwright").ElementHandle
            ) => any;
          }
          ```
        - [x] Add `customData?: Record<string, any>;` to `InteractiveElementInfo`.
        - [x] Add `customAttributeReaders?: CustomAttributeReader[];` to `McpServerOptions`.
    - **Task 3.6.1.2**: Enhance `DomParser` (`src/core/dom-parser.ts`)
      - [x] Modify constructor to accept and store `customAttributeReaders`.
      - [x] In `getInteractiveElementsWithState`, iterate through `customAttributeReaders`:
        - [x] Read the specified attribute using `getElementAttribute`.
        - [x] If found, populate `elementInfo.customData[reader.outputKey]` using `reader.processValue` if provided, or the raw value.
        - [x] Handle potential errors from `processValue` gracefully (log warning, store error marker).
        - [x] Update logging to include extracted custom data.
      - [x] Update logging to include extracted custom data.
    - **Task 3.6.1.3**: Enhance `PlaywrightController` (`src/core/playwright-controller.ts`)
      - [x] Modify constructor to accept and store `customAttributeReaders`.
      - [x] In `getElementState`, similarly iterate `customAttributeReaders` and populate `customData` in the returned state object. This ensures consistency if `getElementState` is used to get a full element snapshot including custom fields.
    - **Task 3.6.1.4**: Update `mcp_server.ts`
      - [x] Pass `options.customAttributeReaders` from `McpServerOptions` to `DomParser` and `PlaywrightController` constructors.
    - **Task 3.6.1.5**: Documentation
      - [x] Update `README.md` to explain how to use `customAttributeReaders` in `McpServerOptions`.
      - [x] Provide examples of custom attribute definitions and their usage in the frontend.

  - **Sub-Phase 3.6.2: Custom Action Handlers**

    - **Goal**: Enable library users to define their own logic for handling specific commands (either entirely new custom commands or overriding default behaviors for existing commands like `click` or `type`) associated with `data-mcp-*` attributes or general interactions.
    - **Approach**:
      - Define an `AutomationInterface` to expose safe Playwright actions.
      - Define types for handler parameters and callbacks.
      - Allow users to register `CustomActionHandler` objects via `McpServerOptions`.
      - Modify `mcp_server.ts` to prioritize custom handlers and fall back to core logic.
    - **Tasks**:
      - **Task 3.6.2.1**: Define Types in `src/types/index.ts`
        - [x] Define `AutomationInterface` (to wrap safe PlaywrightController actions).
        - [x] Define `CustomActionHandlerParams` (input for custom handlers: `element: InteractiveElementInfo`, `commandArgs: string[]`, `automation: AutomationInterface`).
        - [x] Define `CustomActionHandlerCallback` (function type: `(params: CustomActionHandlerParams) => Promise<ActionResult>;`).
        - [x] Define `CustomActionHandler` (interface: `commandName: string`, `handler: CustomActionHandlerCallback`, `overrideCoreBehavior?: boolean`).
        - [x] Add `customActionHandlers?: CustomActionHandler[];` to `McpServerOptions`.
      - **Task 3.6.2.2**: Implement `AutomationInterface`
        - [x] Create methods in/alongside `PlaywrightController` that wrap existing actions (e.g., `click`, `type`) providing a simplified and safe API.
      - **Task 3.6.2.3**: Enhance `mcp_server.ts`
        - [x] In `runMcpServer`:
          - [x] Accept `customActionHandlers` from `McpServerOptions`.
          - [x] Store handlers (e.g., in a `Map<string, CustomActionHandler>`).
        - [x] In `send_command` tool logic:
          - [x] Parse `command_string` to get `commandName`, `elementId`, and `commandArgs`.
          - [x] If a registered custom handler matches `commandName`:
            - [x] Fetch `InteractiveElementInfo` for `elementId` (e.g., using `playwrightController.getElementState()`).
            - [x] Construct `CustomActionHandlerParams`.
            - [x] Invoke the custom handler and return its `ActionResult`.
          - [x] Else (no custom handler or not overriding core):
            - [x] Execute existing built-in logic for core commands.
          - [x] Else (unknown command):
            - [x] Return "Unknown command" `ActionResult`.
      - **Task 3.6.2.4**: Documentation
        - [x] Update `README.md` to explain how to define and use `customActionHandlers`.
        - [x] Provide examples of custom handlers for new commands and overriding existing ones.

  - **Sub-Phase 3.6.3: Advanced Parser Customization (Future Consideration)**
    - **Goal**: Allow users to inject custom logic directly into the DOM parsing process.
