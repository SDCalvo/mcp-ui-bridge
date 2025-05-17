import { Page, Locator } from "playwright";

export interface InteractiveElementInfo {
  id: string; // Value of data-interactive-element
  tagName: string;
  // We can add more properties like textContent, attributes, etc. later
}

export class DomParser {
  constructor(private page: Page) {}

  async findInteractiveElements(): Promise<InteractiveElementInfo[]> {
    console.log("Scanning for interactive elements...");
    const elementsLocator: Locator = this.page.locator(
      "[data-interactive-element]"
    );
    const count = await elementsLocator.count();
    console.log(`Found ${count} interactive element(s).`);

    const foundElements: InteractiveElementInfo[] = [];

    for (let i = 0; i < count; i++) {
      const element = elementsLocator.nth(i);
      const elementId = await element.getAttribute("data-interactive-element");
      const tagName = await element.evaluate((el) => el.tagName.toLowerCase());

      if (elementId) {
        console.log(`  - Element ID: ${elementId}, Tag: ${tagName}`);
        foundElements.push({ id: elementId, tagName });
      } else {
        console.warn(
          "Found an element with data-interactive-element attribute but no value."
        );
      }
    }
    return foundElements;
  }

  // Future method for display elements
  // async findDisplayElements() { ... }
}
