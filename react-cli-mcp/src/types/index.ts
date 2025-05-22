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
  customData?: Record<string, any>; // For user-defined custom attributes
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

// --- Authentication Related Types ---

/**
 * Context object passed to the custom authentication callback.
 * Provides details about the incoming MCP client request.
 */
export interface ClientAuthContext {
  /**
   * HTTP headers from the incoming request.
   * Header names will be lowercase.
   * Values can be string or array of strings (for multi-value headers).
   */
  headers: Record<string, string | string[] | undefined>;

  /**
   * The source IP address of the incoming request.
   * Note: Accuracy can be affected by proxies. Library users should consider
   * X-Forwarded-For header if their server is behind a reverse proxy.
   * This should be documented by the library user for their specific setup.
   */
  sourceIp?: string;

  // TODO: Consider adding other relevant request details if they become available
  // from FastMCP and are useful for authentication (e.g., original URL, method).
}

/**
 * Signature for the user-provided custom authentication function.
 * @param context - The authentication context containing request details.
 * @returns A Promise that resolves to `true` if authentication is successful,
 * or `false` otherwise.
 */
export type AuthenticateClientCallback = (
  context: ClientAuthContext
) => Promise<boolean>;

// --- MCP Server Options ---

/**
 * Configuration options for running the MCP server.
 */
export interface McpServerOptions {
  /** The target URL of the web application to interact with. */
  targetUrl: string;

  /**
   * Port number for the MCP server to listen on.
   * Defaults to a port defined in `mcp_server.ts` if not provided (e.g., 8090).
   */
  port?: number;

  /**
   * Whether to run the Playwright browser in headless mode.
   * Defaults to `true` (headless). Set to `false` for visual debugging.
   */
  headlessBrowser?: boolean;

  /**
   * The SSE (Server-Sent Events) endpoint path for MCP communication.
   * Must start with a '/'. Example: "/sse" or "/mcp-events".
   * Defaults to a path defined in `mcp_server.ts` if not provided (e.g., "/sse").
   */
  sseEndpoint?: `/${string}`;

  /**
   * Optional. A user-provided asynchronous function to authenticate incoming MCP client requests.
   * If provided, this function will be called for each new client connection attempt.
   * The function should return a Promise that resolves to `true` if authentication is successful,
   * or `false` otherwise.
   * If an error occurs within this function, react-cli-mcp will log it, and the authentication
   * will be treated as failed (resulting in a 401 Unauthorized response).
   * If this option is not provided, the MCP server will be open and will not perform
   * any client authentication checks.
   */
  authenticateClient?: AuthenticateClientCallback;

  /** Optional. Name of the MCP server. Defaults to "react-cli-mcp-server". */
  serverName?: string;

  /**
   * Optional. Version of the MCP server in X.Y.Z format. Defaults to "0.1.0".
   * Must conform to the semantic versioning format if provided.
   */
  serverVersion?: `${number}.${number}.${number}`;

  /**
   * Optional. Instructions for the LLM on how to use this server and its tools.
   * This might be included in a system prompt by the MCP client.
   */
  serverInstructions?: string;

  /**
   * Optional. An array of custom attribute reader configurations.
   * Allows users to specify additional `data-mcp-*` attributes to be extracted
   * by the DomParser and included in `InteractiveElementInfo.customData`.
   */
  customAttributeReaders?: CustomAttributeReader[];
}

/**
 * Defines how a custom data attribute should be read and processed.
 */
export interface CustomAttributeReader {
  /** The full name of the custom data attribute (e.g., "data-mcp-priority"). */
  attributeName: string;
  /** The key under which the extracted value will be stored in `InteractiveElementInfo.customData`. */
  outputKey: string;
  /**
   * Optional. A function to process the raw attribute string value.
   * If not provided, the raw string value (or undefined if not found) will be used.
   * @param attributeValue The raw string value of the attribute. Can be null if attribute not present.
   * @param elementHandle The Playwright ElementHandle, for more complex processing if needed.
   * @returns The processed value to be stored.
   */
  processValue?: (
    attributeValue: string | null,
    elementHandle?: import("playwright").ElementHandle // Forward reference
  ) => any;
}
