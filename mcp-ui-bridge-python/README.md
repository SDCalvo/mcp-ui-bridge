# MCP UI Bridge (Python)

A Python tool to enable Large Language Models (LLMs) to interact with web applications through a terminal-like interface using the Model Context Protocol (MCP).

## Overview

This project aims to replicate the functionality of the original TypeScript `mcp-ui-bridge` in Python. It uses Playwright for web interaction and FastMCP for MCP communication.

## Features (Planned)

- Parse web applications using `data-mcp-*` attributes.
- Generate a CLI representation of interactive elements.
- Facilitate LLM-to-webapp communication via MCP.
- Extensible with custom data extractors and action handlers.

## Getting Started

(Instructions to be added once the project is further along)

### Prerequisites

- Python 3.8+
- `uv` package manager (recommended)

### Installation (Provisional)

```bash
# Clone the repository (once public)
# git clone https://github.com/your-username/mcp-ui-bridge-python.git
# cd mcp-ui-bridge-python

# Create virtual environment and install dependencies
uv venv .venv
source .venv/bin/activate # or .venv\Scripts\activate on Windows
uv pip install -r requirements.txt # Or from pyproject.toml once fully configured

# Install Playwright browsers
python -m playwright install
```

## Usage

(To be added)

## Contributing

(To be added)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
