import { Page, Locator, ElementHandle } from "playwright";
import {
  InteractiveElementInfo,
  DisplayContainerInfo,
  DisplayItem,
  PageRegionInfo,
  StatusMessageAreaInfo,
  LoadingIndicatorInfo,
  ActionResult,
  ParserResult,
  PlaywrightErrorType,
  DomParserErrorType,
  CustomAttributeReader,
} from "../types/index.js"; // Adjusted path
import { DataAttributes } from "../types/attributes.js"; // Import the new constants object

// Import centralized types
// import { ParserResult, DomParserErrorType } from "./types.js"; // REMOVED THIS LINE

export class DomParser {
  constructor(
    private page: Page | null,
    private customAttributeReaders: CustomAttributeReader[] = []
  ) {}

  private async getElementAttribute(
    element: ElementHandle,
    attributeName: string
  ): Promise<string | undefined> {
    if (!this.page) {
      console.error(
        "getElementAttribute called when page is null. This should not happen."
      );
      throw new Error("Page is not available for getElementAttribute.");
    }
    const attrValue = await element.getAttribute(attributeName);
    return attrValue === null ? undefined : attrValue;
  }

  private async getElementType(element: ElementHandle): Promise<string> {
    if (!this.page) {
      console.error(
        "getElementType called when page is null. This should not happen."
      );
      throw new Error("Page is not available for getElementType.");
    }
    const explicitType = await this.getElementAttribute(
      element,
      DataAttributes.ELEMENT_TYPE
    );
    if (explicitType && explicitType.trim()) {
      return explicitType.trim().toLowerCase();
    }

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
    if (!this.page) {
      console.error(
        "getElementLabel called when page is null. This should not happen."
      );
      throw new Error("Page is not available for getElementLabel.");
    }
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

  async getInteractiveElementsWithState(): Promise<
    ParserResult<InteractiveElementInfo[]>
  > {
    if (!this.page) {
      const message =
        "DOM parsing for interactive elements failed: Page object is not available.";
      console.error(message);
      return {
        success: false,
        message,
        errorType: DomParserErrorType.PageNotAvailable,
        data: undefined,
      };
    }

    console.log("Scanning for interactive elements with state...");
    try {
      const elementsLocator: Locator = this.page.locator(
        `[${DataAttributes.INTERACTIVE_ELEMENT}]`
      );
      const count = await elementsLocator.count();
      console.log(`Found ${count} interactive element(s) with state.`);

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

        // Get type using the updated getElementType method which prioritizes data-mcp-element-type
        const elementType = await this.getElementType(elementHandle);
        const label = await this.getElementLabel(elementHandle, elementId);

        let currentValue: string | undefined = undefined;
        let isChecked: boolean | undefined = undefined;
        let isDisabled: boolean | undefined = undefined;
        let isReadOnly: boolean | undefined = undefined;

        // Prioritize data-mcp-value
        currentValue = await this.getElementAttribute(
          elementHandle,
          DataAttributes.VALUE
        );

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

        // Enhanced state extraction based on element type
        let options: InteractiveElementInfo["options"];
        let radioName: string | undefined; // For grouping radio buttons

        if (elementType.startsWith("input-")) {
          if (
            elementType === "input-checkbox" ||
            elementType === "input-radio"
          ) {
            isChecked = await elementHandle.isChecked();
            if (elementType === "input-radio") {
              // For radio buttons, also attempt to get the name attribute for grouping
              radioName =
                (await elementHandle.getAttribute("name")) || undefined;
            }
          } else if (
            ![
              "input-button",
              "input-submit",
              "input-reset",
              "input-file",
            ].includes(elementType) // Exclude types that don't have inputValue or where it's not relevant
          ) {
            if (currentValue === undefined) {
              // Only try inputValue if data-mcp-value wasn't set
              try {
                currentValue = await elementHandle.inputValue();
              } catch (e: any) {
                console.warn(
                  `Could not retrieve inputValue for ${elementId} (type: ${elementType}): ${e.message}`
                );
                currentValue = undefined;
              }
            }
          }
        } else if (elementType === "select") {
          // For select elements, get options
          const optionElements = await elementHandle.$$("option");
          options = [];
          for (const optionEl of optionElements) {
            const value = (await optionEl.getAttribute("value")) || ""; // Default value to empty string if null
            const text = (await optionEl.textContent()) || ""; // Default text to empty string if null
            const selected = await optionEl.evaluate(
              (el) => (el as HTMLOptionElement).selected
            );
            options.push({ value, text: text.trim(), selected });
            // If this option is selected, its value becomes the currentValue of the select
            if (selected && currentValue === undefined) {
              // Prioritize data-mcp-value if set
              currentValue = value;
            }
          }
          // If no option is explicitly selected and data-mcp-value is not set,
          // Playwright's inputValue on the select itself might give the current value.
          if (currentValue === undefined) {
            try {
              currentValue = await elementHandle.inputValue();
            } catch (e: any) {
              console.warn(
                `Could not retrieve inputValue for select ${elementId}: ${e.message}`
              );
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
        const customState = await this.getElementAttribute(
          elementHandle,
          DataAttributes.ELEMENT_STATE
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
        if (options !== undefined) elementInfo.options = options;
        if (radioName !== undefined && elementType === "input-radio")
          elementInfo.radioGroup = radioName;
        if (purpose !== undefined) elementInfo.purpose = purpose;
        if (group !== undefined) elementInfo.group = group;
        if (controls !== undefined) elementInfo.controls = controls;
        if (updatesContainer !== undefined)
          elementInfo.updatesContainer = updatesContainer;
        if (navigatesTo !== undefined) elementInfo.navigatesTo = navigatesTo;
        if (customState !== undefined) elementInfo.customState = customState;

        // Process custom attributes
        if (
          this.customAttributeReaders &&
          this.customAttributeReaders.length > 0
        ) {
          elementInfo.customData = {}; // Initialize customData
          for (const reader of this.customAttributeReaders) {
            const rawValue = await this.getElementAttribute(
              elementHandle,
              reader.attributeName
            );
            try {
              if (reader.processValue) {
                elementInfo.customData[reader.outputKey] = reader.processValue(
                  rawValue === undefined ? null : rawValue, // Pass null if attribute not found
                  elementHandle
                );
              } else if (rawValue !== undefined) {
                // Only store if attribute exists and no processValue function
                elementInfo.customData[reader.outputKey] = rawValue;
              }
            } catch (e: any) {
              console.warn(
                `Error processing custom attribute "${reader.attributeName}" for element "${elementId}" with key "${reader.outputKey}": ${e.message}`
              );
              elementInfo.customData[reader.outputKey] =
                "ERROR_PROCESSING_ATTRIBUTE";
            }
          }
        }

        let logMessage = `  - ID: ${elementId}, Type: ${elementType}, Label: "${label}"`;
        if (elementInfo.purpose)
          logMessage += `, Purpose: "${elementInfo.purpose}"`;
        if (elementInfo.group) logMessage += `, Group: "${elementInfo.group}"`;
        if (isChecked !== undefined) logMessage += `, Checked: ${isChecked}`;
        if (currentValue !== undefined)
          logMessage += `, Value: "${currentValue}"`;
        if (radioName !== undefined && elementType === "input-radio")
          logMessage += `, RadioGroup: "${radioName}"`;
        if (elementInfo.options) {
          logMessage += `, Options: ${JSON.stringify(
            elementInfo.options.map((o) => ({
              value: o.value,
              text: o.text,
              selected: o.selected,
            }))
          )}`;
        }
        if (isDisabled) logMessage += `, Disabled: true`;
        if (isReadOnly) logMessage += `, ReadOnly: true`;
        if (elementInfo.controls)
          logMessage += `, Controls: "${elementInfo.controls}"`;
        if (elementInfo.updatesContainer)
          logMessage += `, Updates: "${elementInfo.updatesContainer}"`;
        if (elementInfo.navigatesTo)
          logMessage += `, NavigatesTo: "${elementInfo.navigatesTo}"`;
        if (elementInfo.customState)
          logMessage += `, State: "${elementInfo.customState}"`;
        if (
          elementInfo.customData &&
          Object.keys(elementInfo.customData).length > 0
        ) {
          logMessage += `, CustomData: ${JSON.stringify(
            elementInfo.customData
          )}`;
        }
        console.log(logMessage);

        foundElements.push(elementInfo);
      }
      const successMessage = `Successfully parsed ${foundElements.length} interactive elements with state.`;
      return { success: true, message: successMessage, data: foundElements };
    } catch (error: any) {
      const errorMessage =
        "An error occurred while parsing interactive elements with state.";
      console.error(errorMessage, error);
      return {
        success: false,
        message: `${errorMessage} Error: ${error.message}`,
        errorType: DomParserErrorType.ParsingFailed,
        data: undefined,
      };
    }
  }

  async getStructuredData(): Promise<
    ParserResult<{
      containers: DisplayContainerInfo[];
      regions: PageRegionInfo[];
      statusMessages: StatusMessageAreaInfo[];
      loadingIndicators: LoadingIndicatorInfo[];
    }>
  > {
    if (!this.page) {
      const message =
        "DOM parsing for structured data failed: Page object is not available.";
      console.error(message);
      return {
        success: false,
        message,
        errorType: DomParserErrorType.PageNotAvailable,
        data: undefined,
      };
    }
    console.log("Scanning for all structured data elements...");
    try {
      const containersResult = await this.findDisplayContainersInternal();
      const regionsResult = await this.findPageRegionsInternal();
      const statusMessagesResult = await this.findStatusMessageAreasInternal();
      const loadingIndicatorsResult =
        await this.findLoadingIndicatorsInternal();

      const structuredData = {
        containers: containersResult.data || [],
        regions: regionsResult.data || [],
        statusMessages: statusMessagesResult.data || [],
        loadingIndicators: loadingIndicatorsResult.data || [],
      };

      const message = "Successfully retrieved all structured data.";
      return { success: true, message, data: structuredData };
    } catch (error: any) {
      const errorMessage = "An error occurred while parsing structured data.";
      console.error(errorMessage, error);
      return {
        success: false,
        message: `${errorMessage} Error: ${error.message}`,
        errorType: DomParserErrorType.ParsingFailed,
        data: undefined,
      };
    }
  }

  private async findDisplayContainersInternal(): Promise<
    ParserResult<DisplayContainerInfo[]>
  > {
    if (!this.page) {
      return {
        success: false,
        message: "Page not available",
        errorType: DomParserErrorType.PageNotAvailable,
        data: undefined,
      };
    }
    console.log("Scanning for display containers...");
    try {
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
      const successMessage = `Successfully parsed ${foundContainers.length} display containers.`;
      return { success: true, message: successMessage, data: foundContainers };
    } catch (error: any) {
      const errorMessage =
        "An error occurred while parsing display containers.";
      console.error(errorMessage, error);
      return {
        success: false,
        message: `${errorMessage} Error: ${error.message}`,
        errorType: DomParserErrorType.ParsingFailed,
        data: undefined,
      };
    }
  }

  private async findPageRegionsInternal(): Promise<
    ParserResult<PageRegionInfo[]>
  > {
    if (!this.page) {
      return {
        success: false,
        message: "Page not available",
        errorType: DomParserErrorType.PageNotAvailable,
        data: undefined,
      };
    }
    console.log("Scanning for page regions...");
    try {
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
      const successMessage = `Successfully parsed ${foundRegions.length} page regions.`;
      return { success: true, message: successMessage, data: foundRegions };
    } catch (error: any) {
      const errorMessage = "An error occurred while parsing page regions.";
      console.error(errorMessage, error);
      return {
        success: false,
        message: `${errorMessage} Error: ${error.message}`,
        errorType: DomParserErrorType.ParsingFailed,
        data: undefined,
      };
    }
  }

  private async findStatusMessageAreasInternal(): Promise<
    ParserResult<StatusMessageAreaInfo[]>
  > {
    if (!this.page) {
      return {
        success: false,
        message: "Page not available",
        errorType: DomParserErrorType.PageNotAvailable,
        data: undefined,
      };
    }
    console.log("Scanning for status message areas...");
    try {
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
      const successMessage = `Successfully parsed ${foundAreas.length} status message areas.`;
      return { success: true, message: successMessage, data: foundAreas };
    } catch (error: any) {
      const errorMessage =
        "An error occurred while parsing status message areas.";
      console.error(errorMessage, error);
      return {
        success: false,
        message: `${errorMessage} Error: ${error.message}`,
        errorType: DomParserErrorType.ParsingFailed,
        data: undefined,
      };
    }
  }

  private async findLoadingIndicatorsInternal(): Promise<
    ParserResult<LoadingIndicatorInfo[]>
  > {
    if (!this.page) {
      return {
        success: false,
        message: "Page not available",
        errorType: DomParserErrorType.PageNotAvailable,
        data: undefined,
      };
    }
    console.log("Scanning for loading indicators...");
    try {
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
      const successMessage = `Successfully parsed ${foundIndicators.length} loading indicators.`;
      return { success: true, message: successMessage, data: foundIndicators };
    } catch (error: any) {
      const errorMessage =
        "An error occurred while parsing loading indicators.";
      console.error(errorMessage, error);
      return {
        success: false,
        message: `${errorMessage} Error: ${error.message}`,
        errorType: DomParserErrorType.ParsingFailed,
        data: undefined,
      };
    }
  }

  // Future method for display elements
  // async findDisplayElements() { ... }
}
