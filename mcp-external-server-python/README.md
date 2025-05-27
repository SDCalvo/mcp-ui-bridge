# MCP External Server (Python)

This project is a Python port of the `mcp-external-server` (TypeScript) and serves as a testbed for the `mcp-ui-bridge-python` library.

It provides a simple backend server that uses `mcp-ui-bridge-python` to interact with a target web application, typically a toy frontend designed for testing MCP functionalities.

## Features

- Demonstrates usage of `mcp-ui-bridge-python`.
- Includes examples of custom attribute readers.
- Includes examples of custom action handlers.
- Configurable via environment variables and/or a `.env` file.

## Setup

1.  **Prerequisites:**

    - Python 3.10+
    - `uv` (Python package installer and virtual environment manager, see [uv documentation](https://github.com/astral-sh/uv))
    - The `mcp-ui-bridge-python` library (expected to be in a sibling directory, see `pyproject.toml`)

2.  **Virtual Environment and Installation:**
    Navigate to the `mcp-external-server-python` directory.

    ```bash
    # Create a virtual environment (e.g., named .venv)
    uv venv
    # Activate the virtual environment
    # On Windows (PowerShell):
    # .\.venv\Scripts\Activate.ps1
    # On macOS/Linux (bash/zsh):
    # source .venv/bin/activate

    # Install dependencies
    uv pip install -e .[dev] # -e for editable install, [dev] for optional dev dependencies
    ```

3.  **Configuration:**
    Create a `.env` file in the project root (or set environment variables) for the following:

    - `MCP_TARGET_URL`: The URL of the frontend application to interact with (e.g., `http://localhost:5173`).
    - `MCP_PORT`: Port for this server to listen on (e.g., `8070`).
    - `MCP_HEADLESS_BROWSER`: `true` or `false` (defaults to `false`).
    - `MANUALLY_ALLOW_CONNECTION`: `true` or `false` for the dummy authentication.

    Example `.env` file:

    ```
    MCP_TARGET_URL="http://localhost:5173"
    MCP_PORT=8070
    MCP_HEADLESS_BROWSER=false
    MANUALLY_ALLOW_CONNECTION=true
    ```

## Running the Server

Make sure your virtual environment is activated.

```bash
python src/main.py
```

Or, if you set up the console script and your environment is configured correctly:

```bash
start-server
```

This will start the server, and it will attempt to connect to the `MCP_TARGET_URL`.
