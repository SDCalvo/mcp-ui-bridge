import { Page, Locator, ElementHandle } from "playwright";
import {
  InteractiveElementInfo,
  DisplayContainerInfo,
  DisplayItem,
} from "../types"; // Adjusted path
import { DataAttributes } from "../types/attributes"; // Import the new constants object

export class DomParser {
  constructor(private page: Page) {}

  private async getElementType(element: ElementHandle): Promise<string> {
    const tagName = (
      await element.evaluate((el) => (el as Element).tagName)
    ).toLowerCase();
    if (tagName === "input") {
      const type = await element.getAttribute("type");
      return `input-${type || "text"}`.toLowerCase(); // Default to input-text if type is null/empty
    }
    return tagName;
  }

  private async getElementLabel(
    element: ElementHandle,
    elementId: string
  ): Promise<string> {
    let label = await element.getAttribute("aria-label");
    if (label && label.trim()) return label.trim();

    // For non-input elements, textContent is a good candidate for a label
    const elementTypeForLabel = await this.getElementType(element);
    if (!elementTypeForLabel.startsWith("input")) {
      label = await element.textContent();
      if (label && label.trim()) return label.trim();
    }

    // For specific input types, placeholder can be a label
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

    return elementId; // Fallback to elementId
  }

  async findInteractiveElements(): Promise<InteractiveElementInfo[]> {
    console.log("Scanning for interactive elements...");
    const elementsLocator: Locator = this.page.locator(
      `[${DataAttributes.INTERACTIVE_ELEMENT}]`
    );
    const count = await elementsLocator.count();
    console.log(`Found ${count} interactive element(s).`);

    const foundElements: InteractiveElementInfo[] = [];

    for (let i = 0; i < count; i++) {
      const elementHandle = await elementsLocator.nth(i).elementHandle();
      if (!elementHandle) continue;

      const elementId = await elementHandle.getAttribute(
        DataAttributes.INTERACTIVE_ELEMENT
      );

      if (!elementId) {
        console.warn(
          "Found an element with data-mcp-interactive-element attribute but no value. Skipping."
        );
        continue;
      }

      const elementType = await this.getElementType(elementHandle);
      const label = await this.getElementLabel(elementHandle, elementId);

      let currentValue: string | undefined = undefined;
      let isChecked: boolean | undefined = undefined;

      if (elementType.startsWith("input-")) {
        if (elementType === "input-checkbox" || elementType === "input-radio") {
          isChecked = await elementHandle.isChecked();
        } else if (
          elementType !== "input-button" &&
          elementType !== "input-submit" &&
          elementType !== "input-reset"
        ) {
          // For most other input types, try to get inputValue
          currentValue = await elementHandle.inputValue();
        }
      }

      const elementInfo: InteractiveElementInfo = {
        id: elementId,
        elementType,
        label,
      };

      if (currentValue !== undefined) elementInfo.currentValue = currentValue;
      if (isChecked !== undefined) elementInfo.isChecked = isChecked;

      let logMessage = `  - ID: ${elementId}, Type: ${elementType}, Label: "${label}"`;
      if (isChecked !== undefined) logMessage += `, Checked: ${isChecked}`;
      if (currentValue !== undefined)
        logMessage += `, Value: "${currentValue}"`;
      console.log(logMessage);

      foundElements.push(elementInfo);
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
