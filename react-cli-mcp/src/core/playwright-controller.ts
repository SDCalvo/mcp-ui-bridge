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
    console.log("Browser launched and page created.");
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
  private async getElementTypeById(elementId: string): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    const element = this.page.locator(selector).first(); // Assuming ID is unique
    const tagName = (
      await element.evaluate((el) => (el as Element).tagName)
    ).toLowerCase();
    if (tagName === "input") {
      const type = await element.getAttribute("type");
      return `input-${type || "text"}`.toLowerCase();
    }
    return tagName;
  }

  private async getElementLabelById(elementId: string): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");
    const selector = `[${DataAttributes.INTERACTIVE_ELEMENT}="${elementId}"]`;
    const element = this.page.locator(selector).first();

    let label = await element.getAttribute("aria-label");
    if (label && label.trim()) return label.trim();

    const elementTypeForLabel = await this.getElementTypeById(elementId);
    if (!elementTypeForLabel.startsWith("input")) {
      label = await element.textContent();
      if (label && label.trim()) return label.trim();
    }

    if (
      elementTypeForLabel === "input-text" ||
      elementTypeForLabel === "input-password" ||
      elementTypeForLabel === "input-search" ||
      elementTypeForLabel === "input-url" ||
      elementTypeForLabel === "input-tel" ||
      elementTypeForLabel === "input-email"
    ) {
      label = await element.getAttribute("placeholder");
      if (label && label.trim()) return label.trim();
    }
    return elementId; // Fallback
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
      const element = this.page.locator(selector).first(); // Use .first() assuming IDs are unique
      if ((await element.count()) === 0) {
        console.warn(`Element with ID ${elementId} not found.`);
        return null;
      }

      const elementType = await this.getElementTypeById(elementId);
      const label = await this.getElementLabelById(elementId);

      let currentValue: string | undefined = undefined;
      let isChecked: boolean | undefined = undefined;

      if (elementType.startsWith("input-")) {
        if (elementType === "input-checkbox" || elementType === "input-radio") {
          isChecked = await element.isChecked();
        } else if (
          elementType !== "input-button" &&
          elementType !== "input-submit" &&
          elementType !== "input-reset"
        ) {
          currentValue = await element.inputValue();
        }
      }

      const state: Partial<InteractiveElementInfo> = {
        id: elementId,
        elementType,
        label,
      };
      if (currentValue !== undefined) state.currentValue = currentValue;
      if (isChecked !== undefined) state.isChecked = isChecked;

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
