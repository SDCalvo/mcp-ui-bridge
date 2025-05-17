import { Page, Locator, ElementHandle } from "playwright";
import {
  InteractiveElementInfo,
  DisplayContainerInfo,
  DisplayItem,
  PageRegionInfo,
  StatusMessageAreaInfo,
  LoadingIndicatorInfo,
} from "../types"; // Adjusted path
import { DataAttributes } from "../types/attributes"; // Import the new constants object

export class DomParser {
  constructor(private page: Page) {}

  private async getElementAttribute(
    element: ElementHandle,
    attributeName: string
  ): Promise<string | undefined> {
    const attrValue = await element.getAttribute(attributeName);
    return attrValue === null ? undefined : attrValue;
  }

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
    let label = await this.getElementAttribute(element, "aria-label");
    if (label && label.trim()) return label.trim();

    const mcpLabel = await this.getElementAttribute(
      element,
      DataAttributes.ELEMENT_LABEL
    );
    if (mcpLabel && mcpLabel.trim()) return mcpLabel.trim();

    // For non-input elements, textContent is a good candidate for a label
    const elementTypeForLabel = await this.getElementType(element);
    if (!elementTypeForLabel.startsWith("input")) {
      const textContent = await element.textContent();
      label = textContent === null ? undefined : textContent.trim();
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
      label = await this.getElementAttribute(element, "placeholder");
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

      const elementId = await this.getElementAttribute(
        elementHandle,
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
      let isDisabled: boolean | undefined = undefined;
      let isReadOnly: boolean | undefined = undefined;

      const mcpDisabled = await this.getElementAttribute(
        elementHandle,
        DataAttributes.DISABLED_STATE
      );
      if (mcpDisabled !== undefined) {
        isDisabled = mcpDisabled === "true";
      } else {
        isDisabled = await elementHandle.isDisabled();
      }

      const mcpReadOnly = await this.getElementAttribute(
        elementHandle,
        DataAttributes.READONLY_STATE
      );
      if (mcpReadOnly !== undefined) {
        isReadOnly = mcpReadOnly === "true";
      } else {
        // Playwright's isEditable can be a proxy for not readonly for inputs
        if (elementType.startsWith("input-") || elementType === "textarea") {
          isReadOnly = !(await elementHandle.isEditable());
        }
      }

      if (elementType.startsWith("input-")) {
        if (elementType === "input-checkbox" || elementType === "input-radio") {
          isChecked = await elementHandle.isChecked();
        } else if (
          ![
            "input-button",
            "input-submit",
            "input-reset",
            "input-file",
          ].includes(elementType) // Exclude types that don't have inputValue or where it's not relevant
        ) {
          try {
            currentValue = await elementHandle.inputValue();
          } catch (e) {
            // Silently catch if inputValue is not applicable, e.g. for some button-like inputs
            currentValue = undefined;
          }
        }
      }

      const purpose = await this.getElementAttribute(
        elementHandle,
        DataAttributes.PURPOSE
      );
      const group = await this.getElementAttribute(
        elementHandle,
        DataAttributes.GROUP
      );
      const controls = await this.getElementAttribute(
        elementHandle,
        DataAttributes.CONTROLS
      );
      const updatesContainer = await this.getElementAttribute(
        elementHandle,
        DataAttributes.UPDATES_CONTAINER
      );
      const navigatesTo = await this.getElementAttribute(
        elementHandle,
        DataAttributes.NAVIGATES_TO
      );

      const elementInfo: InteractiveElementInfo = {
        id: elementId,
        elementType,
        label,
        isDisabled,
        isReadOnly,
      };

      if (currentValue !== undefined) elementInfo.currentValue = currentValue;
      if (isChecked !== undefined) elementInfo.isChecked = isChecked;
      if (purpose !== undefined) elementInfo.purpose = purpose;
      if (group !== undefined) elementInfo.group = group;
      if (controls !== undefined) elementInfo.controls = controls;
      if (updatesContainer !== undefined)
        elementInfo.updatesContainer = updatesContainer;
      if (navigatesTo !== undefined) elementInfo.navigatesTo = navigatesTo;

      let logMessage = `  - ID: ${elementId}, Type: ${elementType}, Label: "${label}"`;
      if (elementInfo.purpose)
        logMessage += `, Purpose: "${elementInfo.purpose}"`;
      if (elementInfo.group) logMessage += `, Group: "${elementInfo.group}"`;
      if (isChecked !== undefined) logMessage += `, Checked: ${isChecked}`;
      if (currentValue !== undefined)
        logMessage += `, Value: "${currentValue}"`;
      if (isDisabled) logMessage += `, Disabled: true`;
      if (isReadOnly) logMessage += `, ReadOnly: true`;
      if (elementInfo.controls)
        logMessage += `, Controls: "${elementInfo.controls}"`;
      if (elementInfo.updatesContainer)
        logMessage += `, Updates: "${elementInfo.updatesContainer}"`;
      if (elementInfo.navigatesTo)
        logMessage += `, NavigatesTo: "${elementInfo.navigatesTo}"`;
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
      const containerElementHandle = await containerLocator
        .nth(i)
        .elementHandle();
      if (!containerElementHandle) continue;

      const containerId = await this.getElementAttribute(
        containerElementHandle,
        DataAttributes.DISPLAY_CONTAINER
      );
      if (!containerId) {
        console.warn(
          "Found an element with data-display-container attribute but no value. Skipping."
        );
        continue;
      }

      const region = await this.getElementAttribute(
        containerElementHandle,
        DataAttributes.REGION
      );
      const purpose = await this.getElementAttribute(
        containerElementHandle,
        DataAttributes.PURPOSE
      );

      console.log(`  - Container ID: ${containerId}`);
      if (region) console.log(`    Region: "${region}"`);
      if (purpose) console.log(`    Purpose: "${purpose}"`);

      // Locator for items directly under the current container based on DISPLAY_ITEM_TEXT
      const itemsLocator = this.page.locator(
        `[${DataAttributes.DISPLAY_CONTAINER}="${containerId}"] [${DataAttributes.DISPLAY_ITEM_TEXT}]`
      );
      const itemCount = await itemsLocator.count();
      console.log(
        `    Found ${itemCount} display item(s) in container '${containerId}'.`
      );

      const items: DisplayItem[] = [];
      for (let j = 0; j < itemCount; j++) {
        const itemElementHandle = await itemsLocator.nth(j).elementHandle();
        if (!itemElementHandle) continue;

        const itemId = await this.getElementAttribute(
          itemElementHandle,
          DataAttributes.DISPLAY_ITEM_ID
        );
        const textContentResult = await itemElementHandle.textContent();
        const textContent =
          textContentResult === null ? undefined : textContentResult.trim();

        const fields: Record<string, string> = {};
        // Use ElementHandle.$$ to find child elements with the FIELD_NAME attribute
        const fieldElementHandles = await itemElementHandle.$$(
          `[${DataAttributes.FIELD_NAME}]`
        );

        for (const fieldElementHandle of fieldElementHandles) {
          const fieldName = await this.getElementAttribute(
            fieldElementHandle,
            DataAttributes.FIELD_NAME
          );
          const fieldValueResult = await fieldElementHandle.textContent();
          const fieldValue =
            fieldValueResult === null ? undefined : fieldValueResult.trim();
          if (fieldName && fieldValue !== undefined) {
            fields[fieldName] = fieldValue;
          }
        }

        const displayItem: DisplayItem = {
          text: textContent || "", // Fallback for text
        };
        if (itemId) displayItem.itemId = itemId;
        if (Object.keys(fields).length > 0) displayItem.fields = fields;

        items.push(displayItem);
        let itemLog = `      - Item`;
        if (itemId) itemLog += ` ID: "${itemId}"`;
        itemLog += `, Text: "${displayItem.text}"`;
        if (displayItem.fields)
          itemLog += `, Fields: ${JSON.stringify(displayItem.fields)}`;
        console.log(itemLog);
      }
      foundContainers.push({ containerId, items, region, purpose });
    }
    return foundContainers;
  }

  async findPageRegions(): Promise<PageRegionInfo[]> {
    console.log("Scanning for page regions...");
    const regionLocator: Locator = this.page.locator(
      `[${DataAttributes.REGION}]`
    );
    const count = await regionLocator.count();
    console.log(`Found ${count} page region(s).`);
    const foundRegions: PageRegionInfo[] = [];

    for (let i = 0; i < count; i++) {
      const elementHandle = await regionLocator.nth(i).elementHandle();
      if (!elementHandle) continue;

      const regionId = await this.getElementAttribute(
        elementHandle,
        DataAttributes.REGION
      );
      if (!regionId) {
        console.warn(
          "Found an element with data-mcp-region attribute but no value. Skipping."
        );
        continue;
      }
      const label = await this.getElementLabel(elementHandle, regionId); // Use getElementLabel for consistency
      const purpose = await this.getElementAttribute(
        elementHandle,
        DataAttributes.PURPOSE
      );

      foundRegions.push({ regionId, label, purpose });
      console.log(
        `  - Region ID: "${regionId}", Label: "${label}"${
          purpose ? `, Purpose: "${purpose}"` : ""
        }`
      );
    }
    return foundRegions;
  }

  async findStatusMessageAreas(): Promise<StatusMessageAreaInfo[]> {
    console.log("Scanning for status message areas...");
    const areaLocator: Locator = this.page.locator(
      `[${DataAttributes.STATUS_MESSAGE_CONTAINER}]`
    );
    const count = await areaLocator.count();
    console.log(`Found ${count} status message area(s).`);
    const foundAreas: StatusMessageAreaInfo[] = [];

    for (let i = 0; i < count; i++) {
      const elementHandle = await areaLocator.nth(i).elementHandle();
      if (!elementHandle) continue;

      const containerId = await this.getElementAttribute(
        elementHandle,
        DataAttributes.STATUS_MESSAGE_CONTAINER
      );
      if (!containerId) {
        // ID is the value of the attribute itself
        console.warn(
          "Found an element with data-mcp-status-message-container attribute but no value. Skipping."
        );
        continue;
      }
      const purpose = await this.getElementAttribute(
        elementHandle,
        DataAttributes.PURPOSE
      );
      // This simple version takes all text content. More sophisticated logic might be needed for multiple distinct messages.
      const textContentResult = await elementHandle.textContent();
      const messages = textContentResult
        ? [textContentResult.trim()].filter((m) => m.length > 0)
        : [];

      foundAreas.push({ containerId, messages, purpose });
      console.log(
        `  - Status Area ID: "${containerId}", Messages: ${JSON.stringify(
          messages
        )}${purpose ? `, Purpose: "${purpose}"` : ""}`
      );
    }
    return foundAreas;
  }

  async findLoadingIndicators(): Promise<LoadingIndicatorInfo[]> {
    console.log("Scanning for loading indicators...");
    const indicatorLocator: Locator = this.page.locator(
      `[${DataAttributes.LOADING_INDICATOR_FOR}]`
    );
    const count = await indicatorLocator.count();
    console.log(`Found ${count} loading indicator(s).`);
    const foundIndicators: LoadingIndicatorInfo[] = [];

    for (let i = 0; i < count; i++) {
      const elementHandle = await indicatorLocator.nth(i).elementHandle();
      if (!elementHandle) continue;

      // The loading indicator should ideally have its own unique ID via data-mcp-interactive-element or a simple id.
      // For now, we'll try to generate a unique reference if no MCP ID is present.
      let elementId = await this.getElementAttribute(
        elementHandle,
        DataAttributes.INTERACTIVE_ELEMENT
      );
      if (!elementId) {
        elementId = await this.getElementAttribute(elementHandle, "id");
        if (!elementId) {
          // Fallback, not ideal for stable identification
          elementId = `loading-indicator-${i}`;
        }
      }

      const isLoadingFor = await this.getElementAttribute(
        elementHandle,
        DataAttributes.LOADING_INDICATOR_FOR
      );
      if (!isLoadingFor) {
        console.warn(
          "Found an element with data-mcp-loading-indicator-for attribute but no value. Skipping."
        );
        continue;
      }
      const textContentResult = await elementHandle.textContent();
      const text =
        textContentResult === null ? undefined : textContentResult.trim();

      foundIndicators.push({
        elementId,
        isLoadingFor,
        text: text || undefined,
      });
      console.log(
        `  - Loading Indicator ID: "${elementId}", isLoadingFor: "${isLoadingFor}"${
          text ? `, Text: "${text}"` : ""
        }`
      );
    }
    return foundIndicators;
  }

  // Future method for display elements
  // async findDisplayElements() { ... }
}
