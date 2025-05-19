import { chromium, Browser, Page, BrowserContext, Locator } from "playwright";
import { DataAttributes } from "../types/attributes.js";
import { InteractiveElementInfo } from "../types/index.js";
// Import centralized types
import { ActionResult, PlaywrightErrorType } from "./types.js";

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly DEFAULT_TIMEOUT = 5000; // ms

  constructor(
    private launchOptions: { headless?: boolean } = { headless: true }
  ) {}

  async launch(): Promise<ActionResult> {
    // Uses imported ActionResult
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
        errorType: PlaywrightErrorType.BrowserLaunchFailed, // Uses imported Enum
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
    // Uses imported ActionResult
    if (!this.page) {
      const message =
        "Navigation failed: Page is not initialized. Call launch() first.";
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      }; // Corrected ErrorType
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
      let errorType: PlaywrightErrorType = PlaywrightErrorType.NavigationFailed; // Uses imported Enum
      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
      }
      return {
        success: false,
        message: `${errMessage} Error: ${error.message}`,
        errorType,
      };
    }
  }

  getPage(): Page | null {
    if (!this.page) {
      console.warn("getPage() called but page is not initialized.");
    }
    return this.page;
  }

  async close(): Promise<ActionResult> {
    // Uses imported ActionResult
    if (!this.browser) {
      const message = "Browser close skipped: Not launched or already closed.";
      console.warn(message);
      return { success: true, message };
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
      this.browser = null;
      this.context = null;
      this.page = null;
      return {
        success: false,
        message: `${errMessage} Error: ${error.message}`,
        errorType: PlaywrightErrorType.BrowserCloseFailed, // Uses imported Enum
      };
    }
  }

  async click(
    elementId: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    // Renamed from clickElement, uses imported ActionResult
    if (!this.page) {
      const message = `Click failed for element '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      }; // Corrected ErrorType
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to click element with ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first();
      if ((await element.count()) === 0) {
        const message = `Click failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        }; // Uses imported Enum
      }
      await element.waitFor({ state: "visible", timeout });
      await element.click({ timeout });
      const message = `Successfully clicked element with ID: ${elementId}`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error clicking element with ID ${elementId}:`, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed; // Uses imported Enum
      let errMessage = `Failed to click element with ID '${elementId}'.`;

      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be visible or clickable.`;
        // Example: checking for visibility error (Playwright messages might vary)
      } else if (error.message?.toLowerCase().includes("not visible")) {
        errorType = PlaywrightErrorType.ActionFailed; // Or a more specific one if you add it to PlaywrightErrorType
      } else if (
        error.message?.toLowerCase().includes("not clickable") ||
        error.message?.toLowerCase().includes("intercepted by another element")
      ) {
        errorType = PlaywrightErrorType.ActionFailed; // Or a more specific one
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async type(
    elementId: string,
    textToType: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    // Renamed from typeInElement, uses imported ActionResult
    if (!this.page) {
      const message = `Type failed for element '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      }; // Corrected ErrorType
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
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        }; // Uses imported Enum
      }
      await element.waitFor({ state: "visible", timeout });
      if (!(await element.isEditable({ timeout }))) {
        const message = `Type failed: Element with ID '${elementId}' is not editable.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ActionFailed,
        }; // Or a more specific one
      }
      await element.fill(textToType, { timeout });
      const message = `Successfully typed "${textToType}" in element with ID: ${elementId}`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error typing in element with ID ${elementId}:`, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed; // Uses imported Enum
      let errMessage = `Failed to type in element with ID '${elementId}'.`;

      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be visible or editable.`;
      } else if (error.message?.toLowerCase().includes("not visible")) {
        errorType = PlaywrightErrorType.ActionFailed; // Or a more specific one
      } else if (
        error.message?.toLowerCase().includes("not editable") ||
        error.message?.toLowerCase().includes("disabled")
      ) {
        errorType = PlaywrightErrorType.ActionFailed; // Or a more specific one
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  private async getElementTypeFromLocator(
    elementLocator: Locator
  ): Promise<string> {
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
      const typeAttr = await this.getAttribute(elementLocator, "type"); // Renamed variable to avoid conflict
      return `input-${typeAttr || "text"}`.toLowerCase();
    }
    return tagName;
  }

  private async getElementLabelFromLocator(
    elementLocator: Locator,
    elementId: string,
    elementType: string
  ): Promise<string> {
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
    // Uses imported ActionResult
    if (!this.page) {
      const message = `Get element state failed for '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable, // Corrected ErrorType
        data: null,
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(`Getting state for element with ID: ${elementId}`);
    try {
      const elementLocator = this.page.locator(selector).first();
      await elementLocator.waitFor({ state: "attached", timeout });

      if ((await elementLocator.count()) === 0) {
        const message = `Get element state failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound, // Uses imported Enum
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
        if (
          elementType.startsWith("input-") ||
          elementType === "textarea" ||
          elementType === "select"
        ) {
          isReadOnly = !(await elementLocator.isEditable({ timeout }));
          if (isDisabled && isReadOnly) {
            isReadOnly = false;
            const actualReadOnly = await elementLocator.evaluate(
              (el) => (el as HTMLInputElement).readOnly
            );
            if (actualReadOnly) isReadOnly = true;
          }
        }
      }

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
            "input-file",
          ].includes(elementType)
        ) {
          try {
            currentValue = await elementLocator.inputValue({ timeout });
          } catch (e: any) {
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
      return { success: true, message, data: state };
    } catch (error: any) {
      let errMessage = `Error getting state for element with ID ${elementId}.`;
      console.error(errMessage, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed; // Default, use imported Enum

      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be ready for state retrieval. The element might be transitioning or not fully loaded.`;
        errMessage +=
          " Consider retrying the 'state' command after a brief pause, or use 'scan' to refresh the view.";
      } else if (error.message?.includes("not found")) {
        errorType = PlaywrightErrorType.ElementNotFound;
        errMessage = `Get element state failed: Element with ID '${elementId}' not found.`;
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
        data: null,
      };
    }
  }
}
