import { chromium, Browser, Page, BrowserContext, Locator } from "playwright";
import { DataAttributes } from "../types/attributes.js";
import {
  InteractiveElementInfo,
  ActionResult,
  PlaywrightErrorType,
  CustomAttributeReader,
  AutomationInterface,
} from "../types/index.js";

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly DEFAULT_TIMEOUT = 5000; // ms

  constructor(
    private launchOptions: { headless?: boolean } = { headless: true },
    private customAttributeReaders: CustomAttributeReader[] = []
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
    text: string,
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
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to type into element ID: ${elementId} (selector: ${selector}) with text: "${text}"`
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
        };
      }
      await element.waitFor({ state: "visible", timeout });
      await element.fill(text, { timeout }); // 'fill' is generally recommended over 'type' for inputs
      const message = `Successfully typed "${text}" into element with ID: ${elementId}.`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error typing into element with ID ${elementId}:`, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed;
      let errMessage = `Failed to type into element with ID '${elementId}'.`;

      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be ready for typing.`;
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async selectOption(
    elementId: string,
    value: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Select option failed for element '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to select option with value "${value}" in element ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first();
      if ((await element.count()) === 0) {
        const message = `Select option failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        };
      }
      await element.waitFor({ state: "visible", timeout });
      await element.selectOption({ value }, { timeout });
      const message = `Successfully selected option "${value}" in element with ID: ${elementId}.`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(
        `Error selecting option in element with ID ${elementId}:`,
        error
      );
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed;
      let errMessage = `Failed to select option in element with ID '${elementId}'.`;
      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' or option '${value}'.`;
      } else if (error.message?.includes("No option found for value")) {
        errorType = PlaywrightErrorType.OptionNotFound;
        errMessage = `Option with value '${value}' not found in element '${elementId}'.`;
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async checkElement(
    elementId: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Check element failed for '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to check element ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first();
      if ((await element.count()) === 0) {
        const message = `Check element failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        };
      }
      await element.waitFor({ state: "visible", timeout });
      await element.check({ timeout });
      const message = `Successfully checked element with ID: ${elementId}.`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error checking element with ID ${elementId}:`, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed;
      let errMessage = `Failed to check element with ID '${elementId}'.`;
      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be checkable.`;
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async uncheckElement(
    elementId: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Uncheck element failed for '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to uncheck element ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first();
      if ((await element.count()) === 0) {
        const message = `Uncheck element failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        };
      }
      await element.waitFor({ state: "visible", timeout });
      await element.uncheck({ timeout });
      const message = `Successfully unchecked element with ID: ${elementId}.`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error unchecking element with ID ${elementId}:`, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed;
      let errMessage = `Failed to uncheck element with ID '${elementId}'.`;
      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be uncheckable.`;
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async selectRadioButton(
    radioButtonIdInGroup: string,
    valueToSelect: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Select radio button failed for group associated with '${radioButtonIdInGroup}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      };
    }

    const groupMemberSelector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${radioButtonIdInGroup}"]`;
    console.log(
      `Attempting to select radio button with value "${valueToSelect}" in group identified by element ID: ${radioButtonIdInGroup}`
    );

    try {
      const groupMemberElement = this.page.locator(groupMemberSelector).first();
      if ((await groupMemberElement.count()) === 0) {
        const message = `Select radio button failed: Initial element with ID '${radioButtonIdInGroup}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        };
      }
      await groupMemberElement.waitFor({ state: "visible", timeout });

      const radioGroupName = await groupMemberElement.getAttribute("name");
      if (!radioGroupName) {
        const message = `Select radio button failed: Element with ID '${radioButtonIdInGroup}' does not have a 'name' attribute for grouping.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.AttributeNotFound,
        };
      }

      // Selector for the specific radio button in the group with the target value
      const targetRadioSelector = `input[type="radio"][name="${radioGroupName}"][value="${valueToSelect}"]`;
      const targetRadioElement = this.page.locator(targetRadioSelector).first();

      if ((await targetRadioElement.count()) === 0) {
        const message = `Select radio button failed: Radio button with name '${radioGroupName}' and value '${valueToSelect}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.OptionNotFound, // Reusing for radio options
        };
      }

      // It's possible the target radio button itself doesn't have the data-mcp-interactive-element attribute,
      // but it's part of the group. We identify the group by one member that *does* have the mcp id.
      // We click the one that matches the name and value.
      await targetRadioElement.waitFor({ state: "visible", timeout });
      await targetRadioElement.click({ timeout }); // Could also use .check()

      const message = `Successfully selected radio button with value "${valueToSelect}" in group "${radioGroupName}".`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(
        `Error selecting radio button for group associated with ID ${radioButtonIdInGroup}, value ${valueToSelect}:`,
        error
      );
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed;
      let errMessage = `Failed to select radio button.`;
      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for radio button elements.`;
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async hoverElement(
    elementId: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Hover failed for element '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to hover over element ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first();
      if ((await element.count()) === 0) {
        const message = `Hover failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        };
      }
      await element.waitFor({ state: "visible", timeout });
      await element.hover({ timeout });
      const message = `Successfully hovered over element with ID: ${elementId}.`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error hovering over element with ID ${elementId}:`, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed;
      let errMessage = `Failed to hover over element with ID '${elementId}'.`;
      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be hoverable.`;
      }
      return {
        success: false,
        message: `${errMessage} Details: ${error.message}`,
        errorType,
      };
    }
  }

  async clearElement(
    elementId: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ActionResult> {
    if (!this.page) {
      const message = `Clear failed for element '${elementId}': Page not initialized.`;
      console.error(message);
      return {
        success: false,
        message,
        errorType: PlaywrightErrorType.PageNotAvailable,
      };
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to clear element ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector).first();
      if ((await element.count()) === 0) {
        const message = `Clear failed: Element with ID '${elementId}' not found.`;
        console.warn(message);
        return {
          success: false,
          message,
          errorType: PlaywrightErrorType.ElementNotFound,
        };
      }
      await element.waitFor({ state: "visible", timeout });
      await element.fill("", { timeout }); // Using fill with empty string to clear
      const message = `Successfully cleared element with ID: ${elementId}.`;
      console.log(message);
      return { success: true, message };
    } catch (error: any) {
      console.error(`Error clearing element with ID ${elementId}:`, error);
      let errorType: PlaywrightErrorType = PlaywrightErrorType.ActionFailed;
      let errMessage = `Failed to clear element with ID '${elementId}'.`;
      if (error.name === "TimeoutError") {
        errorType = PlaywrightErrorType.Timeout;
        errMessage = `Timeout waiting for element '${elementId}' to be clearable.`;
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

      // Process custom attributes
      if (
        this.customAttributeReaders &&
        this.customAttributeReaders.length > 0
      ) {
        state.customData = {}; // Initialize customData
        for (const reader of this.customAttributeReaders) {
          const rawValue = await this.getAttribute(
            elementLocator, // Use the locator here
            reader.attributeName
          );
          try {
            if (reader.processValue) {
              const elementHandle = await elementLocator.elementHandle(); // Get ElementHandle for processValue
              state.customData[reader.outputKey] = reader.processValue(
                rawValue === undefined ? null : rawValue,
                elementHandle || undefined // Pass ElementHandle or undefined
              );
            } else if (rawValue !== undefined) {
              state.customData[reader.outputKey] = rawValue;
            }
          } catch (e: any) {
            console.warn(
              `Error processing custom attribute "${reader.attributeName}" for element "${elementId}" with key "${reader.outputKey}" in PlaywrightController: ${e.message}`
            );
            state.customData[reader.outputKey] = "ERROR_PROCESSING_ATTRIBUTE";
          }
        }
      }

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

// --- Implementation of AutomationInterface for Custom Action Handlers ---

/**
 * Provides a safe and simplified set of automation methods, wrapping PlaywrightController.
 * This is passed to custom action handlers.
 */
export class AutomationInterfaceImpl implements AutomationInterface {
  constructor(private playwrightController: PlaywrightController) {}

  async click(elementId: string, timeout?: number): Promise<ActionResult> {
    return this.playwrightController.click(elementId, timeout);
  }

  async type(
    elementId: string,
    text: string,
    timeout?: number
  ): Promise<ActionResult> {
    return this.playwrightController.type(elementId, text, timeout);
  }

  async selectOption(
    elementId: string,
    value: string,
    timeout?: number
  ): Promise<ActionResult> {
    return this.playwrightController.selectOption(elementId, value, timeout);
  }

  async checkElement(
    elementId: string,
    timeout?: number
  ): Promise<ActionResult> {
    return this.playwrightController.checkElement(elementId, timeout);
  }

  async uncheckElement(
    elementId: string,
    timeout?: number
  ): Promise<ActionResult> {
    return this.playwrightController.uncheckElement(elementId, timeout);
  }

  async selectRadioButton(
    radioButtonIdInGroup: string,
    valueToSelect: string, // Matches PlaywrightController's expectation
    timeout?: number
  ): Promise<ActionResult> {
    return this.playwrightController.selectRadioButton(
      radioButtonIdInGroup,
      valueToSelect,
      timeout
    );
  }

  async hoverElement(
    elementId: string,
    timeout?: number
  ): Promise<ActionResult> {
    return this.playwrightController.hoverElement(elementId, timeout);
  }

  async clearElement(
    elementId: string,
    timeout?: number
  ): Promise<ActionResult> {
    return this.playwrightController.clearElement(elementId, timeout);
  }

  async getElementState(
    elementId: string,
    timeout?: number
  ): Promise<ActionResult<Partial<InteractiveElementInfo> | null>> {
    return this.playwrightController.getElementState(elementId, timeout);
  }
}
