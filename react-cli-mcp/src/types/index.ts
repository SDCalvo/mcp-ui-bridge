// Placeholder for shared type definitions
// export {}; Removed this line

// Added from src/core/types.ts
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
  NotInitialized = "NotInitialized", // Added this
  OptionNotFound = "OptionNotFound", // For select/radio options not found
  AttributeNotFound = "AttributeNotFound", // For when a required HTML attribute is missing (e.g., name for radio group)
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
// End of added types

export interface InteractiveElementInfo {
  id: string; // Value of data-mcp-interactive-element
  elementType: string; // e.g., 'button', 'input-text', 'input-checkbox', 'select', 'input-radio'
  label: string; // Best available label (aria-label, textContent, placeholder, or id)
  currentValue?: string; // For input fields, selected value of a select
  isChecked?: boolean; // For checkboxes/radio buttons
  isDisabled?: boolean; // From data-mcp-disabled or inferred
  isReadOnly?: boolean; // From data-mcp-readonly or inferred
  purpose?: string; // From data-mcp-purpose
  group?: string; // From data-mcp-group
  radioGroup?: string; // From the 'name' attribute of a radio button, for grouping
  options?: Array<{ value: string; text: string; selected?: boolean }>; // For select elements
  controls?: string; // From data-mcp-controls (ID of element it controls)
  updatesContainer?: string; // From data-mcp-updates-container (ID of container it updates)
  navigatesTo?: string; // From data-mcp-navigates-to (URL or view identifier)
  customState?: string; // From data-mcp-element-state
  // We can add more properties like attributes, etc. later
}

export interface DisplayItem {
  itemId?: string; // From data-mcp-display-item-id
  text: string; // textContent of the element, or primary text from data-mcp-field if multiple fields
  fields?: Record<string, string>; // Key-value pairs from child elements with data-mcp-field
}

export interface DisplayContainerInfo {
  containerId: string; // Value of data-mcp-display-container
  items: DisplayItem[];
  region?: string; // From data-mcp-region, if the container itself is marked as a region or is within one.
  purpose?: string; // From data-mcp-purpose, if the container has an overall purpose
}

// Optional: For elements that are primarily for page structure/regions
export interface PageRegionInfo {
  regionId: string; // Value of data-mcp-region
  label?: string; // An accessible name for the region (e.g., from aria-label)
  purpose?: string; // From data-mcp-purpose
  // We might list interactive elements or display containers within this region later.
}

// Optional: For dedicated status message areas
export interface StatusMessageAreaInfo {
  containerId: string; // Value of data-mcp-status-message-container
  messages: string[]; // Current messages, requires a way to extract them
  purpose?: string; // From data-mcp-purpose
}

// Optional: For loading indicators
export interface LoadingIndicatorInfo {
  elementId: string; // ID of the loading indicator element itself
  isLoadingFor: string; // ID of the element/container it indicates loading for
  // Potentially text content if the indicator has a message e.g. "Loading..."
  text?: string;
}
