from dataclasses import dataclass, field
from typing import Any, Optional, TypeVar, Generic, Union
from mcp_ui_bridge_python.models.enums import PlaywrightErrorType, DomParserErrorType

T = TypeVar('T')

@dataclass
class ActionResult(Generic[T]):
    success: bool
    message: Optional[str] = None
    data: Optional[T] = None
    error_type: Optional[Union[PlaywrightErrorType, str]] = None

@dataclass
class ParserResult(Generic[T]):
    success: bool
    message: Optional[str] = None
    data: Optional[T] = None
    error_type: Optional[Union[DomParserErrorType, str]] = None 