import { chromium, Browser, Page, BrowserContext, Locator } from "playwright";
import { DataAttributes } from "../types/attributes";
import { InteractiveElementInfo } from "../types";

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(
    private launchOptions: { headless?: boolean } = { headless: true }
  ) {}

  async launch(): Promise<void> {
    if (this.browser) {
      console.warn("Browser already launched.");
      return;
    }
    this.browser = await chromium.launch(this.launchOptions);
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    // Add a listener for the 'close' event on the page
    this.page.on("close", () => {
      console.error(
        "Playwright page event: 'close' fired. The page has been closed."
      );
    });

    console.log("Browser launched and page created.");
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
    }
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not initialized. Call launch() first.");
    }
    console.log(`Navigating to ${url}...`);
    await this.page.goto(url, options);
    console.log("Navigation successful.");
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Page is not initialized. Call launch() first.");
    }
    return this.page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log("Browser closed.");
    } else {
      console.warn("Browser was not launched, cannot close.");
    }
  }

  // --- Interaction Methods ---
  async clickElement(elementId: string): Promise<void> {
    if (!this.page) {
      throw new Error(
        "Page is not initialized. Call launch() and navigate() first."
      );
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to click element with ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector);
      await element.waitFor({ state: "visible", timeout: 5000 });
      await element.click({ timeout: 5000 });
      console.log(`Successfully clicked element with ID: ${elementId}`);
    } catch (error) {
      console.error(`Error clicking element with ID ${elementId}:`, error);
      throw new Error(
        `Failed to click element with ID ${elementId}. Element may not be visible, clickable, or found.`
      );
    }
  }

  async typeInElement(elementId: string, textToType: string): Promise<void> {
    if (!this.page) {
      throw new Error(
        "Page is not initialized. Call launch() and navigate() first."
      );
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(
      `Attempting to type "${textToType}" in element with ID: ${elementId} (selector: ${selector})`
    );
    try {
      const element = this.page.locator(selector);
      await element.waitFor({ state: "visible", timeout: 5000 });
      await element.fill(textToType, { timeout: 5000 });
      console.log(
        `Successfully typed "${textToType}" in element with ID: ${elementId}`
      );
    } catch (error) {
      console.error(`Error typing in element with ID ${elementId}:`, error);
      throw new Error(
        `Failed to type in element with ID ${elementId}. Element may not be editable or found.`
      );
    }
  }

  // --- Helper methods for element state retrieval (similar to DomParser, but for single elements) ---
  private async getElementTypeFromLocator(
    elementLocator: Locator
  ): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");
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
    if (!this.page) throw new Error("Page not initialized");

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
    return elementId;
  }

  async getElementState(
    elementId: string
  ): Promise<Partial<InteractiveElementInfo> | null> {
    if (!this.page) {
      console.error(
        "Page is not initialized. Call launch() and navigate() first."
      );
      return null;
    }
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    console.log(`Getting state for element with ID: ${elementId}`);
    try {
      const elementLocator = this.page.locator(selector).first();
      if ((await elementLocator.count()) === 0) {
        console.warn(`Element with ID ${elementId} not found.`);
        return null;
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

      const mcpDisabled = await this.getAttribute(
        elementLocator,
        DataAttributes.DISABLED_STATE
      );
      if (mcpDisabled !== undefined) {
        isDisabled = mcpDisabled === "true";
      } else {
        isDisabled = await elementLocator.isDisabled();
      }

      const mcpReadOnly = await this.getAttribute(
        elementLocator,
        DataAttributes.READONLY_STATE
      );
      if (mcpReadOnly !== undefined) {
        isReadOnly = mcpReadOnly === "true";
      } else {
        if (elementType.startsWith("input-") || elementType === "textarea") {
          isReadOnly = !(await elementLocator.isEditable());
        }
      }

      if (elementType.startsWith("input-")) {
        if (elementType === "input-checkbox" || elementType === "input-radio") {
          isChecked = await elementLocator.isChecked();
        } else if (
          ![
            "input-button",
            "input-submit",
            "input-reset",
            "input-file",
          ].includes(elementType)
        ) {
          try {
            currentValue = await elementLocator.inputValue();
          } catch (e) {
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

      console.log(`State for element ${elementId}:`, state);
      return state;
    } catch (error) {
      console.error(
        `Error getting state for element with ID ${elementId}:`,
        error
      );
      return null;
    }
  }
}
