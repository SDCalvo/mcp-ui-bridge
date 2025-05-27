# Placeholder for main CLI application logic
import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

import typer
from typing_extensions import Annotated
from pydantic.fields import FieldInfo # For checking field properties in Pydantic v2
from pydantic_core import PydanticUndefined # For checking default values

# Assuming mcp_server.main can be refactored or we call run_mcp_server directly
from .mcp_server import run_mcp_server, McpServerOptions # Changed from main to run_mcp_server
from .models import CustomAttributeReader, CustomActionHandler # For config loading if needed later

app = typer.Typer(
    name="mcp-ui-bridge",
    help="MCP UI Bridge: A server to control a web UI via Playwright, inspired by react-cli-mcp.",
    add_completion=False,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO) # Ensure logger is configured

def load_options_from_config_file(config_path: Path) -> dict:
    if not config_path.is_file():
        logger.warning(f"Config file {config_path} not found. Skipping.")
        return {}
    try:
        config_data = json.loads(config_path.read_text())
        logger.info(f"Successfully loaded configuration from {config_path}")
        return config_data
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON from config file {config_path}: {e}. Skipping.")
        return {}
    except Exception as e:
        logger.error(f"Error reading config file {config_path}: {e}. Skipping.")
        return {}

@app.command()
def start(
    config_file: Annotated[
        Optional[Path],
        typer.Option(
            "--config",
            "-c",
            help="Path to a JSON configuration file for McpServerOptions.",
            exists=False, # Allow path even if file doesn't exist, handle in loading
            file_okay=True,
            dir_okay=False,
            writable=False,
            readable=True,
            resolve_path=True,
        ),
    ] = None,
    target_url: Annotated[
        Optional[str],
        typer.Option(help="Target URL for the browser to navigate to initially.")
    ] = None,
    port: Annotated[
        Optional[int],
        typer.Option(help="Port for the MCP server to listen on.")
    ] = None,
    host: Annotated[
        Optional[str],
        typer.Option(help="Host for the MCP server to bind to.")
    ] = None,
    headless: Annotated[
        Optional[bool], # typer. conferma bool con flag --headless/--no-headless
        typer.Option(help="Run the browser in headless mode.", ) # Default determined by McpServerOptions or env
    ] = None,
    server_name: Annotated[Optional[str], typer.Option(help="Name of the MCP server.")] = None,
    server_version: Annotated[Optional[str], typer.Option(help="Version of the MCP server (e.g., 1.0.0).")] = None,
    server_instructions: Annotated[Optional[str], typer.Option(help="Instruction string for the MCP server.")] = None,
    # We might need to handle custom_attribute_readers and custom_action_handlers loading here
    # if they are complex and not directly passable as simple CLI args or basic JSON.
    # For now, assuming they are part of the config file.
) -> None:
    """
    Starts the MCP UI Bridge server.
    """
    logger.info("MCP UI Bridge (Python) CLI starting...")

    config_from_file = {}
    if config_file:
        config_from_file = load_options_from_config_file(config_file)

    # Determine option precedence: CLI > Config File > Environment Variables > Pydantic Model Defaults

    # Helper to resolve options
    def _resolve_option(cli_val, file_key, env_var, default_from_model=None, is_bool=False, is_int=False):
        if cli_val is not None:
            return cli_val
        if file_key in config_from_file:
            return config_from_file[file_key]
        env_val_str = os.environ.get(env_var)
        if env_val_str is not None:
            if is_bool:
                return env_val_str.lower() == "true"
            if is_int:
                try:
                    return int(env_val_str)
                except ValueError:
                    logger.warning(f"Invalid integer value for env var {env_var}: {env_val_str}. Using model default.")
                    return default_from_model # Fallback to model default if env var is bad
            return env_val_str
        return default_from_model


    # These defaults are from McpServerOptions Pydantic model if not specified anywhere else.
    # For now, we let Pydantic handle defaults if nothing is passed.
    # However, to implement full precedence for all vars, we might need to query model defaults.
    
    # For complex types like custom_attribute_readers, custom_action_handlers,
    # they are typically best loaded from the config file.
    # We'll assume McpServerOptions can take them as dicts from config_from_file.

    final_options_dict = {}
    final_options_dict.update(config_from_file) # Load from config file first

    _target_url = _resolve_option(target_url, "target_url", "MCP_TARGET_URL")
    if _target_url: final_options_dict["target_url"] = _target_url
    
    _port = _resolve_option(port, "port", "MCP_PORT", is_int=True)
    if _port is not None: final_options_dict["port"] = _port
        
    _host = _resolve_option(host, "host", "MCP_HOST")
    if _host: final_options_dict["host"] = _host

    _headless = _resolve_option(headless, "headless_browser", "MCP_HEADLESS", is_bool=True)
    if _headless is not None: final_options_dict["headless_browser"] = _headless

    _server_name = _resolve_option(server_name, "server_name", "MCP_SERVER_NAME") 
    if _server_name: final_options_dict["server_name"] = _server_name # Changed from server_title

    _server_version = _resolve_option(server_version, "server_version", "MCP_SERVER_VERSION")
    if _server_version:
        version_regex_pattern = r"^\d+\.\d+\.\d+$" # Renamed for clarity
        if not re.match(version_regex_pattern, _server_version):
            logger.warning(
                f"Invalid server_version format: \"{_server_version}\". It should be X.Y.Z. Not setting."
            )
        else:
            final_options_dict["server_version"] = _server_version
            
    _server_instructions = _resolve_option(server_instructions, "server_instructions", "MCP_SERVER_INSTRUCTIONS")
    if _server_instructions: final_options_dict["server_instructions"] = _server_instructions # Changed from server_description
    
    # Ensure required fields like target_url are present
    resolved_target_url = final_options_dict.get("target_url")
    if not resolved_target_url:
        target_url_field_info = McpServerOptions.model_fields.get('target_url')
        is_target_url_required = True # Assume required by default
        if target_url_field_info:
            # A field is not required if it has a default value or default_factory
            is_target_url_required = (target_url_field_info.default is PydanticUndefined and 
                                      target_url_field_info.default_factory is None)

        if is_target_url_required and not os.environ.get("MCP_TARGET_URL"): 
             logger.error(
                "CRITICAL: target_url is not configured and no default is available. "
                "Please provide it via --target-url, config file, or MCP_TARGET_URL environment variable."
            )
             raise typer.Exit(code=1)
        # If not required (i.e., has a default in Pydantic model) or env var is set, Pydantic will handle it.

    logger.info(f"Final McpServerOptions dictionary to be used for Pydantic: {final_options_dict}")

    try:
        mcp_options = McpServerOptions(**final_options_dict)
    except Exception as e:
        logger.error(f"Error creating McpServerOptions: {e}")
        logger.error("Please check your configuration parameters (CLI, config file, environment variables).")
        raise typer.Exit(code=1)

    try:
        asyncio.run(run_mcp_server(mcp_options))
    except KeyboardInterrupt:
        logger.info("MCP UI Bridge server process interrupted by user. Exiting.")
    except Exception as e:
        logger.critical(f"MCP UI Bridge server failed to run: {e}")
        raise typer.Exit(code=1)
    finally:
        logger.info("MCP UI Bridge server has shut down.")


if __name__ == "__main__":
    app() 