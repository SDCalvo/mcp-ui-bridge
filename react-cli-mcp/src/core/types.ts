/**
 * Represents the result of an action performed by the PlaywrightController.
 */
export interface ActionResult<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errorType?: PlaywrightErrorType | string; // To categorize errors
}

/**
 * Represents the result of a parsing operation by the DomParser.
 */
export interface ParserResult<T> {
  success: boolean;
  message?: string;
  data?: T;
  errorType?: DomParserErrorType | string; // To categorize errors
}

/**
 * Enum for specific error types from PlaywrightController.
 */
export enum PlaywrightErrorType {
  PageNotAvailable = "PageNotAvailable",
  ElementNotFound = "ElementNotFound",
  Timeout = "Timeout",
  NavigationFailed = "NavigationFailed",
  ActionFailed = "ActionFailed", // Generic action failure
  BrowserLaunchFailed = "BrowserLaunchFailed",
  BrowserCloseFailed = "BrowserCloseFailed",
  InvalidInput = "InvalidInput", // Added new error type
  Unknown = "UnknownPlaywrightError",
}

/**
 * Enum for specific error types from DomParser.
 */
export enum DomParserErrorType {
  PageNotAvailable = "PageNotAvailable", // If parser relies on a page
  ParsingFailed = "ParsingFailed",
  ElementNotFound = "ElementNotFound", // If parsing targets specific elements
  InvalidSelector = "InvalidSelector",
  Unknown = "UnknownParserError",
}

// You might have other shared types here, e.g., for element states if standardized
export interface ElementState {
  id: string; // Unique ID for the element (e.g., from data-testid or a generated selector)
  tagName: string;
  attributes: Record<string, string>;
  textContent?: string | null;
  isVisible?: boolean;
  isEnabled?: boolean;
  // Add other relevant state properties here
  // e.g., value for input fields, checked for checkboxes, etc.
}
