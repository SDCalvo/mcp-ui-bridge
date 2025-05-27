# mcp-ui-bridge: Python Project Plan

## 1. Project Goal & Scope

- **Primary Goal**: To create a tool (`mcp-ui-bridge-python`) that enables a Large Language Model (LLM) to interact with web applications through a terminal-like interface using the Model Context Protocol (MCP).
- **Core Functionality**:
  - Parse a target web application to identify interactive elements and their functionalities.
  - Generate a Command Line Interface (CLI) representation of the web application\'s interactive parts.
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

The `mcp-ui-bridge-python` system will consist of the following main components:

- **Web App Parser (`DomParser`)**:
  - Responsible for analyzing the structure and interactive elements of the target web application using Playwright for Python.
  - Identifies elements marked with various `data-mcp-*` attributes.
  - Extracts relevant information (type, current state, labels, associated actions, displayed text/data).
- **CLI Generation & Interaction Module / MCP Agent Core (`main.py`, `PlaywrightController`)**:
  - This module is the heart of `mcp-ui-bridge-python`. It dynamically understands the current state of the web application via the `DomParser`.
  - Provides a command-line interface for interacting with the application (potentially using Typer or Click).
  - Manages the state of the interaction, including the current "view" or context.
  - Executes actions on the web app using `PlaywrightController`, based on commands.
- **MCP Integration Layer**:
  - Will expose a stable set of generic MCP tools (e.g., `get_current_screen_actions`, `get_current_screen_data`, `send_command`) using FastMCP (Python version).
  - Will format messages according to MCP.
- **Server/Runtime Environment**:
  - Hosts the `mcp-ui-bridge-python` tool.
  - Runs a headless or headed browser (Playwright for Python) to interact with the web application.

### 2.1. Data Attributes for MCP Interaction

To establish a clear and stable contract, specific `data-mcp-*` attributes are used. These will be defined in `mcp_ui_bridge_python/models/attributes.py` (or similar).

**Core Attributes Defined and Used (similar to JS version):**

- `data-mcp-interactive-element="unique-id"`
- `data-mcp-display-container="unique-id"`
- ... (all other attributes remain conceptually the same) ...
- `data-mcp-field="field-name"`

**Parser Inferrence Strategy (similar to JS version):**
The `DomParser` will:

- Infer element type from tag name and attributes.
- Infer labels from `aria-label`, `textContent`, `placeholder`, falling back to ID.
- Infer `disabled`/`readonly` states.
- Extract `value` from input elements.

### High-Level Flow (Current CLI - to be adapted for MCP):

1.  **Initialization**: `mcp-ui-bridge-python` starts, `PlaywrightController` launches Playwright, navigates to the target web app.
2.  **User Assesses Current Screen**:
    - The tool runs an initial scan using `DomParser` and displays available interactive elements, etc. (`display_current_screen_state` in `main.py`).
3.  **User Decides and Enters Command**:
    - User types a command (e.g., `click <id>`, `type <id> "text"`, `state <id>`, `scan`).
4.  **`mcp-ui-bridge-python` Executes Action**:
    - `main.py` parses the command.
    - `PlaywrightController` methods execute the action.
    - `get_element_state` can be used to query specific element details.
5.  **`mcp-ui-bridge-python` Observes Result & Updates State**:
    - The web app responds.
    - The CLI typically re-scans or indicates that a `scan` might be needed.
6.  **Loop**: User continues interacting.

## 3. Web App Parser Details (`DomParser`)

- **Strategy**:
  - **Primary Method**: Utilizes `data-mcp-*` attributes. Scans the live DOM via Playwright for Python.
  - **Information Extracted**: As defined in `mcp_ui_bridge_python/models/elements.py` (e.g., `InteractiveElementInfo`, `DisplayContainerInfo` using Pydantic models or dataclasses), including IDs, types, labels, values/states, purposes, and relationships.
- **Output**: Lists of structured info objects.

## 4. CLI Generation & Interaction Module (`main.py`, `PlaywrightController`)

- **Interaction Model (Current CLI)**:
  - User interacts via text commands in a loop.
  - `main.py` uses a Python CLI library (e.g., Typer, Click, or `prompt_toolkit`) for input.
  - Output is logged to the console.
- **Implemented Commands (similar to JS version)**:
  - `scan`
  - `click <elementId>`
  - `type <elementId> "<text>"`
  - `state <elementId>`
  - `quit`
- **State Management**: `PlaywrightController` maintains the browser and page. `DomParser` performs fresh scans.

## 5. MCP Integration Layer

- **Message Structure**:
  - Define clear MCP message schemas (likely using Pydantic models for validation and serialization).
- **Adapt CLI to MCP**:
  - Implement generic tools (`get_current_screen_actions`, `get_current_screen_data`, `send_command`) using `DomParser` and `PlaywrightController` via FastMCP (Python).

## 6. Key Technologies & Tools

- **Language**: Python (3.8+ recommended).
- **Web Interaction**: `Playwright for Python`.
- **Parsing (DOM)**: Direct DOM APIs via Playwright, orchestrated by `DomParser`.
- **MCP Library**: `FastMCP` (Python version).
- **CLI Input (Optional)**: `Typer`, `Click`, or `prompt_toolkit`.
- **Data Validation/Serialization**: `Pydantic` (recommended).
- **Package Manager & Build Tool**: `uv` (for environment and package management), `pyproject.toml` with a build backend (e.g., `setuptools`, `hatchling`) for building/publishing.

## 7. Development Phases & Roadmap

- **Phase 1: Core Parser, Controller & Basic CLI (Proof of Concept)**

  - **Task 1.1**: Project Setup
    - [ ] Initialize Python project: Create `pyproject.toml` and `README.md`.
    - [ ] Set up virtual environment using `uv venv`.
    - [ ] Install core dependencies using `uv pip install playwright fastmcp pydantic typer` (or a CLI library of choice).
    - [ ] Run `uv run python -m playwright install` (or `python -m playwright install` if `uv run` is not preferred here) for browser binaries.
    - [ ] Create initial directory structure: `mcp_ui_bridge_python/main.py`, `mcp_ui_bridge_python/core/playwright_controller.py`, `mcp_ui_bridge_python/core/dom_parser.py`, `mcp_ui_bridge_python/models/elements.py`, `mcp_ui_bridge_python/models/attributes.py`.
    - [ ] Define project metadata and dependencies in `pyproject.toml`.
    - [ ] Add scripts to `pyproject.toml` (e.g., `[project.scripts] start = "mcp_ui_bridge_python.main:app"`) or define entry points.
    - [ ] Create `.gitignore`.
  - **Task 1.2**: Implement `PlaywrightController` (`mcp_ui_bridge_python/core/playwright_controller.py`)
    - [ ] Launch/close browser and page.
    - [ ] Navigate to URL.
    - [ ] Basic interaction methods: `click_element(element_id)`, `type_in_element(element_id, text)`.
    - [ ] Element state retrieval: `get_element_state(element_id)`.
  - **Task 1.3**: Implement `DomParser` (`mcp_ui_bridge_python/core/dom_parser.py`)
    - [ ] Find interactive elements (`data-mcp-interactive-element`) and extract `InteractiveElementInfo`.
    - [ ] Find display containers, items, and fields, extracting `DisplayContainerInfo`.
    - [ ] Find page regions, status messages, loading indicators.
    - [ ] Helper functions for attribute fetching, label/type inference.
  - **Task 1.4**: Implement Python models and attribute constants
    - [ ] Define data classes or Pydantic models in `mcp_ui_bridge_python/models/elements.py` (e.g., `InteractiveElementInfo`, `DisplayContainerInfo`).
    - [ ] Define attribute constants in `mcp_ui_bridge_python/models/attributes.py`.
  - **Task 1.5**: Create Basic CLI (`mcp_ui_bridge_python/main.py`)
    - [ ] Initialize `PlaywrightController` and `DomParser`.
    - [ ] Implement command loop using Typer/Click.
    - [ ] Implement `scan` command.
    - [ ] Implement `click <id>` command.
    - [ ] Implement `type <id> "<text>"` command.
    - [ ] Implement `state <id>` command.
    - [ ] Implement `quit` command.
    - [ ] Basic console logging.
  - **Task 1.6**: Initial Testing with Todo App
    - [ ] Manually test current CLI commands with the frontend Todo application.

- **Phase 2: Refinement & Robustness**

  - [ ] **Task 2.1**: Enhance `DomParser` and `PlaywrightController`
    - [ ] Ensure full coverage of defined `data-mcp-*` attributes.
    - [ ] Improve error handling (e.g., custom exceptions, structured `ActionResult` like objects), logging, and edge case management.

- **Phase 3: MCP Integration**

  - [ ] **Task 3.1**: Define MCP Message Schemas (using Pydantic)
    - [ ] Define Pydantic models for `get_current_screen_actions`, `get_current_screen_data`, `send_command` (requests & responses).
  - [ ] **Task 3.2**: Implement MCP Layer (`mcp_ui_bridge_python/mcp_server.py`)
    - [ ] Create modules/classes for handling MCP communication using FastMCP (Python).
    - [ ] Adapt `main.py` or create a new entry point (`mcp_server.py`) to act as an MCP server.
    - [ ] Map `DomParser` output to `get_current_screen_actions` and `get_current_screen_data` responses.
    - [ ] Map `send_command` requests to `PlaywrightController` actions.

- **Phase 4: Testing & Validation**

  - [ ] **Task 4.1**: Unit Testing (e.g., using `pytest`)
    - [ ] Write unit tests for parser logic.
    - [ ] Write unit tests for `PlaywrightController`.
    - [ ] Write unit tests for MCP message handling.
  - [ ] **Task 4.2**: Integration Testing
    - [ ] Test CLI functionality (if implemented).
    - [ ] Test MCP server functionality.
    - [ ] Test end-to-end flows with the Todo app.
  - [ ] **Task 4.3**: Performance Testing
    - [ ] Measure response times.
    - [ ] Test with different page complexities.
    - [ ] Identify and address bottlenecks.

- **Phase 5: Package as a Turnkey MCP Server/Tool**

  - **Goal**: Package `mcp-ui-bridge-python` into an easy-to-use tool.
  - [ ] **Task 5.1**: Create configurable entry points.
    - [ ] Programmatic API: `run_mcp_server(options: McpServerOptionsModel)`.
    - [ ] CLI entry point in `main.py` using environment variables or Typer/Click args.
  - [ ] **Task 5.2**: Package for easy distribution (e.g., via PyPI).
    - [ ] Configure `pyproject.toml` for building (e.g., with `setuptools` or `hatchling` as the build backend).
    - [ ] Build the wheel and sdist using `uv build` (or `python -m build`).
    - [ ] Add `README.md` (for PyPI) and `LICENSE` file.
    - [ ] Publish to PyPI (e.g., using `uv publish` or `twine upload`).
  - [ ] **Task 5.3**: Improve documentation.
    - [ ] Update main `README.md` with usage, `data-mcp-*` attributes, and server instructions.
    - [ ] Update library usage details for programmatic use.

- **Phase 6: MCP Server Client Authentication**

  - **Approach**: Custom user-defined asynchronous authentication callback (FastMCP Python should support similar).
  - [ ] **Task 6.1**: Add `authenticate_client` to `McpServerOptionsModel`.
  - [ ] **Task 6.2**: Define `ClientAuthContextModel` (Pydantic model).
  - [ ] **Task 6.3**: Integrate with FastMCP\'s `authenticate` option.
  - [ ] **Task 6.4**: Test auth scenarios.

- **Phase 7: Extensibility for Custom `data-mcp-*` Attributes and Handlers**

  - **Goal**: Allow library users to define custom `data-mcp-*` attributes and action handlers.
  - **Approach**: Similar to JS version, using Python callables and Pydantic models.

  - **Sub-Phase 7.1: Custom Data Extraction**

    - **Task 7.1.1**: Define `CustomAttributeReaderModel` and Update `McpServerOptionsModel`.
      - [ ] In `mcp_ui_bridge_python/models/config.py` (or similar):
        - Define `CustomAttributeReaderModel` (Pydantic model):
          ```python
          # Pydantic or dataclass
          class CustomAttributeReaderModel:
              attribute_name: str
              output_key: str
              process_value: Callable[[Optional[str], Optional[ElementHandle]], Any] = None # ElementHandle from Playwright
          ```
        - Add `custom_data: Optional[Dict[str, Any]]` to `InteractiveElementInfoModel`.
        - Add `custom_attribute_readers: Optional[List[CustomAttributeReaderModel]]` to `McpServerOptionsModel`.
    - **Task 7.1.2**: Enhance `DomParser`.
      - [ ] Modify constructor to accept `custom_attribute_readers`.
      - [ ] In `get_interactive_elements_with_state`, iterate and process.
    - **Task 7.1.3**: Enhance `PlaywrightController`.
      - [ ] Modify constructor for `custom_attribute_readers`.
      - [ ] In `get_element_state`, populate `custom_data`.
    - **Task 7.1.4**: Update MCP server logic (`mcp_server.py`).
      - [ ] Pass `custom_attribute_readers` to `DomParser` and `PlaywrightController`.
    - **Task 7.1.5**: Documentation.

  - **Sub-Phase 7.2: Custom Action Handlers**

    - **Goal**: Enable custom command logic.
    - **Approach**:
      - Define `AutomationInterface` (Python class exposing Playwright actions).
      - Define Pydantic models for handler parameters and callbacks.
      - Register `CustomActionHandlerModel` via `McpServerOptionsModel`.
      - Modify `mcp_server.py` for custom handlers.
    - **Tasks**:
      - **Task 7.2.1**: Define Models in `mcp_ui_bridge_python/models/actions.py` (or similar).
        - [ ] Define `AutomationInterface` (class).
        - [ ] Define `CustomActionHandlerParamsModel` (Pydantic model: `element: InteractiveElementInfoModel`, `command_args: List[str]`, `automation: AutomationInterface`).
        - [ ] Define `CustomActionHandlerCallback` (type hint: `Callable[[CustomActionHandlerParamsModel], Awaitable[ActionResultModel]]`).
        - [ ] Define `CustomActionHandlerModel` (Pydantic model: `command_name: str`, `handler: CustomActionHandlerCallback`, `override_core_behavior: bool = False`).
        - [ ] Add `custom_action_handlers: Optional[List[CustomActionHandlerModel]]` to `McpServerOptionsModel`.
      - **Task 7.2.2**: Implement `AutomationInterface`.
        - [ ] Create methods wrapping `PlaywrightController` actions.
      - **Task 7.2.3**: Enhance `mcp_server.py`.
        - [ ] Accept `custom_action_handlers`.
        - [ ] Store handlers (e.g., in a `Dict[str, CustomActionHandlerModel]`).
        - [ ] In `send_command` tool logic, prioritize custom handlers.
      - **Task 7.2.4**: Documentation.

  - **Sub-Phase 7.3: Advanced Parser Customization (Future Consideration)**
    - **Goal**: Allow users to inject custom logic directly into the DOM parsing process.
