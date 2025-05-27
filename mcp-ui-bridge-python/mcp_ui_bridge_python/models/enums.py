from enum import Enum

class PlaywrightErrorType(str, Enum):
    PageNotAvailable = "PageNotAvailable"
    ElementNotFound = "ElementNotFound"
    Timeout = "Timeout"
    NavigationFailed = "NavigationFailed"
    ActionFailed = "ActionFailed"  # Generic action failure
    BrowserLaunchFailed = "BrowserLaunchFailed"
    BrowserCloseFailed = "BrowserCloseFailed"
    InvalidInput = "InvalidInput"
    NotInitialized = "NotInitialized"
    OptionNotFound = "OptionNotFound"  # For select/radio options not found
    AttributeNotFound = "AttributeNotFound"  # For when a required HTML attribute is missing
    Unknown = "UnknownPlaywrightError"

class DomParserErrorType(str, Enum):
    PageNotAvailable = "PageNotAvailable"  # If parser relies on a page
    ParsingFailed = "ParsingFailed"
    ElementNotFound = "ElementNotFound"  # If parsing targets specific elements
    InvalidSelector = "InvalidSelector"
    Unknown = "UnknownParserError" 