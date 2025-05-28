from enum import Enum

class PlaywrightErrorType(str, Enum):
    PageNotAvailable = "PageNotAvailable"
    ElementNotFound = "ElementNotFound"
    Timeout = "Timeout"
    NavigationFailed = "NavigationFailed"
    ActionFailed = "ActionFailed"
    BrowserLaunchFailed = "BrowserLaunchFailed"
    BrowserCloseFailed = "BrowserCloseFailed"
    InvalidInput = "InvalidInput"
    NotInitialized = "NotInitialized"
    OptionNotFound = "OptionNotFound"
    AttributeNotFound = "AttributeNotFound"
    Unknown = "UnknownPlaywrightError"

class DomParserErrorType(str, Enum):
    PageNotAvailable = "PageNotAvailable"
    ParsingFailed = "ParsingFailed"
    ElementNotFound = "ElementNotFound"
    InvalidSelector = "InvalidSelector"
    Unknown = "UnknownParserError"