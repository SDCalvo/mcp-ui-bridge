import { chromium, Browser, Page, BrowserContext, Locator } from "playwright";
import { DataAttributes } from "../types/attributes";
import { InteractiveElementInfo } from "../types";

export interface ActionResult<T = any> {
  success: boolean;
  message?: string;
  errorType?: ActionErrorType;
  data?: T; // For methods that return data, like getElementState
}

/**
 * Categorizes the type of error encountered.
 */
export type ActionErrorType =
  | "BrowserLaunchFailed"
  | "BrowserNotLaunched"
  | "PageNotInitialized"
  | "NavigationFailed"
  | "ElementNotFound"
  | "ElementNotVisible"
  | "ElementNotClickable"
  | "ElementNotEditable"
  | "Timeout"
  | "InteractionFailed"
  | "StateRetrievalFailed"
  | "BrowserCloseFailed"
  | "UnknownError";

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly DEFAULT_TIMEOUT = 5000; // ms

  constructor(
    private launchOptions: { headless?: boolean } = { headless: true }
  ) {}

  async launch(): Promise<ActionResult> {
    if (this.browser) {
      const message = "Browser launch skipped: Already launched.";
      console.warn(message);
      return { success: true, message };
    }
    console.log("Attempting to launch browser...");
    try {
      this.browser = await chromium.launch(this.launchOptions);
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();

      this.page.on("close", () => {
        console.error(
          "Playwright page event: 'close' fired. The page has been closed unexpectedly."
        );
      });
      const message = "Browser launched and page created successfully.";
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      const errMessage = "Failed to launch browser or create page.";
      console.error(errMessage, error);
      this.browser = null;
      this.context = null;
      this.page = null;
      return {
        success: false,
        message: `${errMessage} Error: ${error.message}`,
        errorType: "BrowserLaunchFailed",
      };
    }
  }

  // Helper to get attribute and convert null to undefined
  private async getAttribute(
    locator: Locator,
    attributeName: string
  ): Promise<string | undefined> {
    const value = await locator.getAttribute(attributeName);
    return value === null ? undefined : value;
  }

  async navigate(
    url: string,
    options?: {
      waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
      timeout?: number;
    }
  ): Promise<ActionResult> {
    if (!this.page) {
      const message =
        "Navigation failed: Page is not initialized. Call launch() first.";
      console.error(message);
      return { success: false, message, errorType: "PageNotInitialized" };
    }
    console.log(`Navigating to ${url}...`);
    try {
      await this.page.goto(url, {
        waitUntil: options?.waitUntil || "domcontentloaded",
        timeout: options?.timeout || this.DEFAULT_TIMEOUT * 2, // Longer timeout for navigation
      });
      const message = `Successfully navigated to ${url}.`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      const errMessage = `Failed to navigate to ${url}.`;
      console.error(errMessage, error);
      let errorType: ActionErrorType = "NavigationFailed";
      if (error.name === "TimeoutError") {
        errorType = "Timeout";
      }
      return {
        success: false,
        message: `${errMessage} Error: ${error.message}`,
        errorType,
      };
    }
  }

  getPage(): Page | null {
    // Consumers should check for null.
    // Or, if strict error prevention is needed here, this could also return an ActionResult.
    // For now, DomParser will need to handle a null page.
    if (!this.page) {
      console.warn("getPage() called but page is not initialized.");
    }
    return this.page;
  }

  async close(): Promise<ActionResult> {
    if (!this.browser) {
      const message = "Browser close skipped: Not launched or already closed.";
      console.warn(message);
      return { success: true, message }; // Considered success as desired state is achieved
    }
    console.log("Attempting to close browser...");
    try {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      const message = "Browser closed successfully.";
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      const errMessage = "Failed to close the browser.";
      console.error(errMessage, error);
      // Even if close fails, set to null to reflect intent
      this.browser = null;
      this.context = null;
      this.page = null;
      return {
        success: false,
        message: `${errMessage} Error: ${error.message}`,
        errorType: "BrowserCloseFailed",
      };
    }
  }

  // --- Interaction Methods ---
  async clickElement(
    elementId: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Click failed for element '${elementId}': Page not initialized.`;
      console.error(message);
      return { success: false, message, errorType: "PageNotInitialized" };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to click element with ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first(); // Ensure we target one element
      if ((await element.count()) === 0) {
        const message = `Click failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return { success: false, message, errorType: "ElementNotFound" };
      }
      await element.waitFor({ state: "visible", timeout });
      await element.click({ timeout }); // Playwright's click also waits for actionable
      const message = `Successfully clicked element with ID: ${elementId}`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error clicking element with ID ${elementId}:`, error);
      let errorType: ActionErrorType = "InteractionFailed";
      let errMessage = `Failed to click element with ID '${elementId}'.`;

      if (error.name === "TimeoutError") {
        errorType = "Timeout";
        errMessage = `Timeout waiting for element '${elementId}' to be visible or clickable.`;
      } else if (
        error.message?.includes("not visible") ||
        error.message?.includes("hidden")
      ) {
        errorType = "ElementNotVisible";
      } else if (
        error.message?.includes("intercepted") ||
        error.message?.includes("not clickable")
      ) {
        errorType = "ElementNotClickable";
      }
      // Add more specific error checks based on common Playwright error messages if needed

      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async typeInElement(
    elementId: string,
    textToType: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Type failed for element '${elementId}': Page not initialized.`;
      console.error(message);
      return { success: false, message, errorType: "PageNotInitialized" };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to type "${textToType}" in element with ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first();
      if ((await element.count()) === 0) {
        const message = `Type failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return { success: false, message, errorType: "ElementNotFound" };
      }
      await element.waitFor({ state: "visible", timeout });
      // Check if editable before fill, Playwright's fill also implies editability check
      if (!(await element.isEditable({ timeout }))) {
        const message = `Type failed: Element with ID '${elementId}' is not editable.`;
        console.warn(message);
        return { success: false, message, errorType: "ElementNotEditable" };
      }
      await element.fill(textToType, { timeout });
      const message = `Successfully typed "${textToType}" in element with ID: ${elementId}`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error typing in element with ID ${elementId}:`, error);
      let errorType: ActionErrorType = "InteractionFailed";
      let errMessage = `Failed to type in element with ID '${elementId}'.`;

      if (error.name === "TimeoutError") {
        errorType = "Timeout";
        errMessage = `Timeout waiting for element '${elementId}' to be visible or editable.`;
      } else if (error.message?.includes("not visible")) {
        errorType = "ElementNotVisible";
      } else if (
        error.message?.includes("not editable") ||
        error.message?.includes("disabled")
      ) {
        errorType = "ElementNotEditable";
      }
      // Add more specific error checks

      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  // --- Helper methods for element state retrieval (similar to DomParser, but for single elements) ---
  private async getElementTypeFromLocator(
    elementLocator: Locator
  ): Promise<string> {
    // This is an internal helper, errors will be caught by getElementState
    // if (!this.page) throw new PlaywrightControllerError("Page not initialized for getElementTypeFromLocator");

    const explicitType = await this.getAttribute(
      elementLocator,
      DataAttributes.ELEMENT_TYPE
    );
    if (explicitType && explicitType.trim()) {
      return explicitType.trim().toLowerCase();
    }

    const tagName = (
      await elementLocator.evaluate((el) => (el as Element).tagName)
    ).toLowerCase();
    if (tagName === "input") {
      const type = await this.getAttribute(elementLocator, "type");
      return `input-${type || "text"}`.toLowerCase();
    }
    return tagName;
  }

  private async getElementLabelFromLocator(
    elementLocator: Locator,
    elementId: string,
    elementType: string
  ): Promise<string> {
    // This is an internal helper, errors will be caught by getElementState
    // if (!this.page) throw new PlaywrightControllerError("Page not initialized for getElementLabelFromLocator");

    let label = await this.getAttribute(elementLocator, "aria-label");
    if (label && label.trim()) return label.trim();

    const mcpLabel = await this.getAttribute(
      elementLocator,
      DataAttributes.ELEMENT_LABEL
    );
    if (mcpLabel && mcpLabel.trim()) return mcpLabel.trim();

    if (!elementType.startsWith("input")) {
      const textContent = await elementLocator.textContent();
      label = textContent === null ? undefined : textContent.trim();
      if (label && label.trim()) return label.trim();
    }

    if (
      elementType.startsWith("input-") &&
      ![
        "input-button",
        "input-submit",
        "input-reset",
        "input-checkbox",
        "input-radio",
      ].includes(elementType)
    ) {
      label = await this.getAttribute(elementLocator, "placeholder");
      if (label && label.trim()) return label.trim();
    }
    return elementId; // Fallback to elementId
  }

  async getElementState(
    elementId: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult<Partial<InteractiveElementInfo> | null>> {
    if (!this.page) {
      const message = `Get element state failed for '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: "PageNotInitialized",
        data: null,
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(`Getting state for element with ID: ${elementId}`);
    try {
      const elementLocator = this.page.locator(selector).first();
      // Wait for the element to be attached, visible might be too strict for state retrieval
      await elementLocator.waitFor({ state: "attached", timeout });

      if ((await elementLocator.count()) === 0) {
        const message = `Get element state failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: "ElementNotFound",
          data: null,
        };
      }

      const elementType = await this.getElementTypeFromLocator(elementLocator);
      const label = await this.getElementLabelFromLocator(
        elementLocator,
        elementId,
        elementType
      );

      let currentValue: string | undefined = undefined;
      let isChecked: boolean | undefined = undefined;
      let isDisabled: boolean | undefined = undefined;
      let isReadOnly: boolean | undefined = undefined;

      // Prioritize data-mcp-value
      currentValue = await this.getAttribute(
        elementLocator,
        DataAttributes.VALUE
      );

      const mcpDisabled = await this.getAttribute(
        elementLocator,
        DataAttributes.DISABLED_STATE
      );
      if (mcpDisabled !== undefined) {
        isDisabled = mcpDisabled === "true";
      } else {
        isDisabled = await elementLocator.isDisabled({ timeout });
      }

      const mcpReadOnly = await this.getAttribute(
        elementLocator,
        DataAttributes.READONLY_STATE
      );
      if (mcpReadOnly !== undefined) {
        isReadOnly = mcpReadOnly === "true";
      } else {
        // isEditable is true if the element is not disabled and not readonly.
        // So, if it's not editable, it could be either disabled or readonly.
        // We already checked isDisabled.
        if (
          elementType.startsWith("input-") ||
          elementType === "textarea" ||
          elementType === "select"
        ) {
          isReadOnly = !(await elementLocator.isEditable({ timeout }));
          if (isDisabled && isReadOnly) {
            // If it's disabled, isEditable is false. Don't mark as readonly unless truly so.
            isReadOnly = false; // Prefer isDisabled = true over isReadOnly = true if both detected via isEditable.
            const actualReadOnly = await elementLocator.evaluate(
              (el) => (el as HTMLInputElement).readOnly
            );
            if (actualReadOnly) isReadOnly = true;
          }
        }
      }

      // Fallback to inputValue if data-mcp-value was not found
      if (
        currentValue === undefined &&
        (elementType.startsWith("input-") ||
          elementType === "textarea" ||
          elementType === "select")
      ) {
        if (elementType === "input-checkbox" || elementType === "input-radio") {
          isChecked = await elementLocator.isChecked({ timeout });
        } else if (
          ![
            "input-button",
            "input-submit",
            "input-reset",
            "input-file", // inputValue for file is complex (fakepath)
          ].includes(elementType)
        ) {
          try {
            // For select, inputValue returns the value of the selected option
            currentValue = await elementLocator.inputValue({ timeout });
          } catch (e: any) {
            // Might fail if element is not input/textarea/select or other issues
            console.warn(
              `Could not retrieve inputValue for ${elementId} (type: ${elementType}): ${e.message}`
            );
            currentValue = undefined;
          }
        }
      }

      const purpose = await this.getAttribute(
        elementLocator,
        DataAttributes.PURPOSE
      );
      const group = await this.getAttribute(
        elementLocator,
        DataAttributes.GROUP
      );
      const controls = await this.getAttribute(
        elementLocator,
        DataAttributes.CONTROLS
      );
      const updatesContainer = await this.getAttribute(
        elementLocator,
        DataAttributes.UPDATES_CONTAINER
      );
      const navigatesTo = await this.getAttribute(
        elementLocator,
        DataAttributes.NAVIGATES_TO
      );
      const customState = await this.getAttribute(
        elementLocator,
        DataAttributes.ELEMENT_STATE
      );

      const state: Partial<InteractiveElementInfo> = {
        id: elementId,
        elementType,
        label,
        isDisabled,
        isReadOnly,
      };

      if (currentValue !== undefined) state.currentValue = currentValue;
      if (isChecked !== undefined) state.isChecked = isChecked;
      if (purpose !== undefined) state.purpose = purpose;
      if (group !== undefined) state.group = group;
      if (controls !== undefined) state.controls = controls;
      if (updatesContainer !== undefined)
        state.updatesContainer = updatesContainer;
      if (navigatesTo !== undefined) state.navigatesTo = navigatesTo;
      if (customState !== undefined) state.customState = customState;

      const message = `Successfully retrieved state for element ${elementId}.`;
      // console.log(message, state); // Avoid overly verbose logging for state
      return { success: true, message, data: state };
    } catch (error: any) {
      let errMessage = `Error getting state for element with ID ${elementId}.`;
      console.error(errMessage, error); // Log the original generic message and the error object
      let errorType: ActionErrorType = "StateRetrievalFailed";

      if (error.name === "TimeoutError") {
        errorType = "Timeout";
        // Specific message for timeout
        errMessage = `Timeout waiting for element '${elementId}' to be ready for state retrieval. The element might be transitioning or not fully loaded.`;
        // Add advice for LLM
        errMessage +=
          " Consider retrying the 'state' command after a brief pause, or use 'scan' to refresh the view.";
      } else if (error.message?.includes("not found")) {
        errorType = "ElementNotFound";
        errMessage = `Get element state failed: Element with ID '${elementId}' not found.`;
      }
      // The final message incorporates the more specific errMessage
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`, // Keep original error details for context if needed
        errorType,
        data: null,
      };
    }
  }
}
