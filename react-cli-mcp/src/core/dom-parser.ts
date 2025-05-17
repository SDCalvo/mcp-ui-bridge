import { Page, Locator } from "playwright";
import {
  InteractiveElementInfo,
  DisplayContainerInfo,
  DisplayItem,
} from "../types"; // Adjusted path
import { DataAttributes } from "../types/attributes"; // Import the new constants object

export class DomParser {
  constructor(private page: Page) {}

  async findInteractiveElements(): Promise<InteractiveElementInfo[]> {
    console.log("Scanning for interactive elements...");
    const elementsLocator: Locator = this.page.locator(
      `[${DataAttributes.INTERACTIVE_ELEMENT}]` // Use the constant
    );
    const count = await elementsLocator.count();
    console.log(`Found ${count} interactive element(s).`);

    const foundElements: InteractiveElementInfo[] = [];

    for (let i = 0; i < count; i++) {
      const element = elementsLocator.nth(i);
      const elementId = await element.getAttribute(
        DataAttributes.INTERACTIVE_ELEMENT
      ); // Use the constant
      const tagName = await element.evaluate((el) => el.tagName.toLowerCase());

      if (elementId) {
        console.log(
          `  - Interactive Element ID: ${elementId}, Tag: ${tagName}`
        );
        foundElements.push({ id: elementId, tagName });
      } else {
        console.warn(
          "Found an element with data-interactive-element attribute but no value."
        );
      }
    }
    return foundElements;
  }

  async findDisplayContainers(): Promise<DisplayContainerInfo[]> {
    console.log("Scanning for display containers...");
    const containerLocator: Locator = this.page.locator(
      `[${DataAttributes.DISPLAY_CONTAINER}]` // Use the constant
    );
    const containerCount = await containerLocator.count();
    console.log(`Found ${containerCount} display container(s).`);

    const foundContainers: DisplayContainerInfo[] = [];

    for (let i = 0; i < containerCount; i++) {
      const containerElement = containerLocator.nth(i);
      const containerId = await containerElement.getAttribute(
        DataAttributes.DISPLAY_CONTAINER // Use the constant
      );

      if (!containerId) {
        console.warn(
          "Found an element with data-display-container attribute but no value. Skipping."
        );
        continue;
      }

      console.log(`  - Container ID: ${containerId}`);
      const itemsLocator = containerElement.locator(
        `[${DataAttributes.DISPLAY_ITEM_TEXT}]` // Use the constant
      );
      const itemCount = await itemsLocator.count();
      console.log(
        `    Found ${itemCount} display item(s) in container '${containerId}'.`
      );

      const items: DisplayItem[] = [];
      for (let j = 0; j < itemCount; j++) {
        const itemElement = itemsLocator.nth(j);
        const textContent = await itemElement.textContent();
        // const itemIdAttr = await itemElement.getAttribute("data-display-item-text"); // If needed later
        if (textContent) {
          items.push({ text: textContent.trim() });
          console.log(`      - Item text: "${textContent.trim()}"`);
        } else {
          console.warn(
            `      - Item in container '${containerId}' has no text content.`
          );
        }
      }
      foundContainers.push({ containerId, items });
    }
    return foundContainers;
  }

  // Future method for display elements
  // async findDisplayElements() { ... }
}
