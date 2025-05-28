from typing import Optional, TypeVar, Generic, Union
from pydantic import BaseModel
from mcp_ui_bridge_python.models.enums import PlaywrightErrorType, DomParserErrorType

T = TypeVar('T')

class ActionResult(BaseModel, Generic[T]):
    success: bool
    message: Optional[str] = None
    data: Optional[T] = None
    error_type: Optional[Union[PlaywrightErrorType, str]] = None

class ParserResult(BaseModel, Generic[T]):
    success: bool
    message: Optional[str] = None
    data: Optional[T] = None
    error_type: Optional[Union[DomParserErrorType, str]] = None