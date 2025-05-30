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

  private async isElementInViewport(element: ElementHandle): Promise<boolean> {
    const boundingBox = await element.boundingBox();
    if (!boundingBox) return false;

    const viewport = await this.page?.viewportSize();
    if (!viewport) return false;

    return (
      boundingBox.x < viewport.width &&
      boundingBox.y < viewport.height &&
      boundingBox.x + boundingBox.width > 0 &&
      boundingBox.y + boundingBox.height > 0
    );
  }

  private async isScrollable(): Promise<boolean> {
    const bodyHandle = await this.page?.$("body");
    if (!bodyHandle) return false;

    const bodyScrollHeight = await bodyHandle.evaluate(
      (body) => body.scrollHeight
    );
    const viewportHeight = (await this.page?.viewportSize())?.height || 0;

    return bodyScrollHeight > viewportHeight;
  }

  private async isAtBottom(): Promise<boolean> {
    const bodyHandle = await this.page?.$("body");
    if (!bodyHandle) return false;

    const bodyScrollHeight = await bodyHandle.evaluate(
      (body) => body.scrollHeight
    );
    const scrollY = (await this.page?.evaluate(() => window.scrollY)) || 0;
    const viewportHeight = (await this.page?.viewportSize())?.height || 0;

    return scrollY + viewportHeight >= bodyScrollHeight;
  }

  async scrollDown(): Promise<void> {
    await this.page?.evaluate(() => window.scrollBy(0, window.innerHeight));
  }

  async scrollUp(): Promise<void> {
    await this.page?.evaluate(() => window.scrollBy(0, -window.innerHeight));
  }

  async getInteractiveElementsWithState(
    startIndex: number = 0,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      elements: InteractiveElementInfo[];
      pagination: {
        totalInViewport: number;
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
      scrollInfo: {
        canScrollDown: boolean;
        canScrollUp: boolean;
        isAtTop: boolean;
        isAtBottom: boolean;
      };
    }>
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

    console.log(
      `Scanning for interactive elements with state (page ${
        Math.floor(startIndex / pageSize) + 1
      })...`
    );
    try {
      const elementsLocator: Locator = this.page.locator(
        `[${DataAttributes.INTERACTIVE_ELEMENT}]`
      );
      const totalElements = await elementsLocator.count();
      console.log(
        `Found ${totalElements} total interactive element(s) with state.`
      );

      // First, identify which elements are in viewport
      const elementsInViewport: number[] = [];
      const elementsOutsideViewport: number[] = [];

      console.log("Analyzing viewport visibility for all elements...");

      for (let i = 0; i < totalElements; i++) {
        const elementHandle = await elementsLocator.nth(i).elementHandle();
        if (!elementHandle) {
          continue;
        }

        // Quick viewport check using bounding box
        const boundingBox = await elementHandle.boundingBox();
        if (!boundingBox) continue;

        const viewport = await this.page?.viewportSize();
        if (!viewport) continue;

        // Check if element is in viewport
        if (
          boundingBox.x < viewport.width &&
          boundingBox.y < viewport.height &&
          boundingBox.x + boundingBox.width > 0 &&
          boundingBox.y + boundingBox.height > 0
        ) {
          elementsInViewport.push(i);
        } else {
          elementsOutsideViewport.push(i);
        }
      }

      const totalInViewport = elementsInViewport.length;
      console.log(
        `Found ${totalInViewport} elements in viewport, ${elementsOutsideViewport.length} outside viewport.`
      );

      // Calculate pagination for viewport elements
      const totalPages = Math.ceil(totalInViewport / pageSize);
      const currentPage = Math.floor(startIndex / pageSize) + 1;
      const endIndex = Math.min(startIndex + pageSize, totalInViewport);
      const hasMore = endIndex < totalInViewport;
      const nextStartIndex = hasMore ? endIndex : undefined;

      // Get the slice of viewport elements for current page
      const elementsToProcess = elementsInViewport.slice(startIndex, endIndex);

      console.log(
        `Processing viewport elements ${
          startIndex + 1
        }-${endIndex} of ${totalInViewport} (page ${currentPage}/${totalPages})`
      );

      const foundElements: InteractiveElementInfo[] = [];

      for (const elementIndex of elementsToProcess) {
        const elementHandle = await elementsLocator
          .nth(elementIndex)
          .elementHandle();
        if (!elementHandle) {
          continue;
        }

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

        const interactiveElementInfo: InteractiveElementInfo = {
          id: elementId,
          elementType,
          label,
          isDisabled,
          isReadOnly,
        };

        if (currentValue !== undefined)
          interactiveElementInfo.currentValue = currentValue;
        if (isChecked !== undefined)
          interactiveElementInfo.isChecked = isChecked;
        if (options !== undefined) interactiveElementInfo.options = options;
        if (radioName !== undefined && elementType === "input-radio")
          interactiveElementInfo.radioGroup = radioName;
        if (purpose !== undefined) interactiveElementInfo.purpose = purpose;
        if (group !== undefined) interactiveElementInfo.group = group;
        if (controls !== undefined) interactiveElementInfo.controls = controls;
        if (updatesContainer !== undefined)
          interactiveElementInfo.updatesContainer = updatesContainer;
        if (navigatesTo !== undefined)
          interactiveElementInfo.navigatesTo = navigatesTo;
        if (customState !== undefined)
          interactiveElementInfo.customState = customState;

        // Process custom attributes
        if (
          this.customAttributeReaders &&
          this.customAttributeReaders.length > 0
        ) {
          interactiveElementInfo.customData = {}; // Initialize customData
          for (const reader of this.customAttributeReaders) {
            const rawValue = await this.getElementAttribute(
              elementHandle,
              reader.attributeName
            );
            try {
              if (reader.processValue) {
                interactiveElementInfo.customData[reader.outputKey] =
                  reader.processValue(
                    rawValue === undefined ? null : rawValue, // Pass null if attribute not found
                    elementHandle
                  );
              } else if (rawValue !== undefined) {
                // Only store if attribute exists and no processValue function
                interactiveElementInfo.customData[reader.outputKey] = rawValue;
              }
            } catch (e: any) {
              console.warn(
                `Error processing custom attribute "${reader.attributeName}" for element "${elementId}" with key "${reader.outputKey}": ${e.message}`
              );
              interactiveElementInfo.customData[reader.outputKey] =
                "ERROR_PROCESSING_ATTRIBUTE";
            }
          }
        }

        let logMessage = `  - ID: ${elementId}, Type: ${elementType}, Label: "${label}"`;
        if (interactiveElementInfo.purpose)
          logMessage += `, Purpose: "${interactiveElementInfo.purpose}"`;
        if (interactiveElementInfo.group)
          logMessage += `, Group: "${interactiveElementInfo.group}"`;
        if (isChecked !== undefined) logMessage += `, Checked: ${isChecked}`;
        if (currentValue !== undefined)
          logMessage += `, Value: "${currentValue}"`;
        if (radioName !== undefined && elementType === "input-radio")
          logMessage += `, RadioGroup: "${radioName}"`;
        if (interactiveElementInfo.options) {
          logMessage += `, Options: ${JSON.stringify(
            interactiveElementInfo.options.map((o) => ({
              value: o.value,
              text: o.text,
              selected: o.selected,
            }))
          )}`;
        }
        if (isDisabled) logMessage += `, Disabled: true`;
        if (isReadOnly) logMessage += `, ReadOnly: true`;
        if (interactiveElementInfo.controls)
          logMessage += `, Controls: "${interactiveElementInfo.controls}"`;
        if (interactiveElementInfo.updatesContainer)
          logMessage += `, Updates: "${interactiveElementInfo.updatesContainer}"`;
        if (interactiveElementInfo.navigatesTo)
          logMessage += `, NavigatesTo: "${interactiveElementInfo.navigatesTo}"`;
        if (interactiveElementInfo.customState)
          logMessage += `, State: "${interactiveElementInfo.customState}"`;
        if (
          interactiveElementInfo.customData &&
          Object.keys(interactiveElementInfo.customData).length > 0
        ) {
          logMessage += `, CustomData: ${JSON.stringify(
            interactiveElementInfo.customData
          )}`;
        }

        console.log(logMessage);

        foundElements.push(interactiveElementInfo);
      }

      // Check scroll capabilities
      const canScrollDown =
        (await this.isScrollable()) && !(await this.isAtBottom());
      const canScrollUp = (await this.page?.evaluate(() => window.scrollY)) > 0;
      const isAtTop = (await this.page?.evaluate(() => window.scrollY)) === 0;
      const isAtBottom = await this.isAtBottom();

      // Provide helpful context about navigation options
      if (hasMore) {
        console.log(
          `More elements available in current viewport. Use pagination to see elements ${
            endIndex + 1
          }-${Math.min(startIndex + pageSize * 2, totalInViewport)}.`
        );
      }

      if (elementsOutsideViewport.length > 0) {
        if (canScrollDown) {
          console.log(
            `${elementsOutsideViewport.length} elements are outside the current viewport. Scrolling down may reveal more elements.`
          );
        }
        if (canScrollUp) {
          console.log(
            "Scrolling up may reveal elements above the current viewport."
          );
        }
      }

      const successMessage = `Successfully parsed ${foundElements.length} interactive elements (page ${currentPage}/${totalPages} of viewport elements).`;

      return {
        success: true,
        message: successMessage,
        data: {
          elements: foundElements,
          pagination: {
            totalInViewport,
            totalElements,
            currentPage,
            totalPages,
            hasMore,
            nextStartIndex,
          },
          scrollInfo: {
            canScrollDown,
            canScrollUp,
            isAtTop,
            isAtBottom,
          },
        },
      };
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

  async getStructuredData(
    startIndex: number = 0,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      containers: DisplayContainerInfo[];
      regions: PageRegionInfo[];
      statusMessages: StatusMessageAreaInfo[];
      loadingIndicators: LoadingIndicatorInfo[];
      pagination: {
        containers: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        regions: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        statusMessages: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        loadingIndicators: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
      };
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
    console.log(
      `Scanning for structured data elements (page ${
        Math.floor(startIndex / pageSize) + 1
      })...`
    );
    try {
      const containersResult = await this.findDisplayContainersInternal(
        startIndex,
        pageSize
      );
      const regionsResult = await this.findPageRegionsInternal(
        startIndex,
        pageSize
      );
      const statusMessagesResult = await this.findStatusMessageAreasInternal(
        startIndex,
        pageSize
      );
      const loadingIndicatorsResult = await this.findLoadingIndicatorsInternal(
        startIndex,
        pageSize
      );

      const structuredData = {
        containers: containersResult.data?.elements || [],
        regions: regionsResult.data?.elements || [],
        statusMessages: statusMessagesResult.data?.elements || [],
        loadingIndicators: loadingIndicatorsResult.data?.elements || [],
        pagination: {
          containers: containersResult.data?.pagination || {
            totalElements: 0,
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
          },
          regions: regionsResult.data?.pagination || {
            totalElements: 0,
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
          },
          statusMessages: statusMessagesResult.data?.pagination || {
            totalElements: 0,
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
          },
          loadingIndicators: loadingIndicatorsResult.data?.pagination || {
            totalElements: 0,
            currentPage: 1,
            totalPages: 0,
            hasMore: false,
          },
        },
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

  private async findDisplayContainersInternal(
    startIndex: number = 0,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      elements: DisplayContainerInfo[];
      pagination: {
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
    }>
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
      const totalElements = await containerLocator.count();
      console.log(`Found ${totalElements} display container(s).`);

      // Calculate pagination
      const totalPages = Math.ceil(totalElements / pageSize);
      const currentPage = Math.floor(startIndex / pageSize) + 1;
      const endIndex = Math.min(startIndex + pageSize, totalElements);
      const hasMore = endIndex < totalElements;
      const nextStartIndex = hasMore ? endIndex : undefined;

      const foundContainers: DisplayContainerInfo[] = [];

      console.log(
        `Processing display containers ${
          startIndex + 1
        }-${endIndex} of ${totalElements} (page ${currentPage}/${totalPages})...`
      );

      for (let i = startIndex; i < endIndex; i++) {
        const containerElementHandle = await containerLocator
          .nth(i)
          .elementHandle();
        if (!containerElementHandle) continue;

        // Quick viewport check using bounding box
        const boundingBox = await containerElementHandle.boundingBox();
        if (!boundingBox) continue;

        const viewport = await this.page?.viewportSize();
        if (!viewport) continue;

        // Skip if element is completely outside viewport
        if (
          boundingBox.y + boundingBox.height < 0 ||
          boundingBox.y > viewport.height ||
          boundingBox.x + boundingBox.width < 0 ||
          boundingBox.x > viewport.width
        ) {
          continue;
        }

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
        // Also limit items processing
        const maxItemsToCheck = Math.min(itemCount, 10);
        for (let j = 0; j < maxItemsToCheck; j++) {
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

      const successMessage = `Successfully parsed ${foundContainers.length} display containers (page ${currentPage}/${totalPages}).`;
      return {
        success: true,
        message: successMessage,
        data: {
          elements: foundContainers,
          pagination: {
            totalElements,
            currentPage,
            totalPages,
            hasMore,
            nextStartIndex,
          },
        },
      };
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

  private async findPageRegionsInternal(
    startIndex: number = 0,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      elements: PageRegionInfo[];
      pagination: {
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
    }>
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
      const totalElements = await regionLocator.count();
      console.log(`Found ${totalElements} page region(s).`);

      // Calculate pagination
      const totalPages = Math.ceil(totalElements / pageSize);
      const currentPage = Math.floor(startIndex / pageSize) + 1;
      const endIndex = Math.min(startIndex + pageSize, totalElements);
      const hasMore = endIndex < totalElements;
      const nextStartIndex = hasMore ? endIndex : undefined;

      const foundRegions: PageRegionInfo[] = [];

      console.log(
        `Processing page regions ${
          startIndex + 1
        }-${endIndex} of ${totalElements} (page ${currentPage}/${totalPages})...`
      );

      for (let i = startIndex; i < endIndex; i++) {
        const regionHandle = await regionLocator.nth(i).elementHandle();
        if (!regionHandle) continue;

        // Check if region itself is in viewport first
        if (!(await this.isElementInViewport(regionHandle))) {
          continue;
        }

        const regionId = await this.getElementAttribute(
          regionHandle,
          DataAttributes.REGION
        );

        if (!regionId) {
          continue;
        }

        const regionLabel = await this.getElementAttribute(
          regionHandle,
          "aria-label"
        );
        const regionPurpose = await this.getElementAttribute(
          regionHandle,
          DataAttributes.PURPOSE
        );

        // Simplified text content extraction with better error handling
        let visibleTextContent = "";
        try {
          const rawTextContent = await regionHandle.textContent();
          if (rawTextContent) {
            // If text is very long, truncate it for performance
            if (rawTextContent.length > 500) {
              visibleTextContent =
                rawTextContent.substring(0, 500) +
                "... [content truncated for performance]";
            } else {
              visibleTextContent = rawTextContent;
            }
          }
        } catch (error) {
          console.warn(
            `Error extracting text content for region ${regionId}:`,
            error
          );
          visibleTextContent = "";
        }

        // Use regionLabel first, then visibleTextContent, then regionId as fallback
        const finalLabel = regionLabel || visibleTextContent || regionId;

        foundRegions.push({
          regionId: regionId,
          label: finalLabel,
          purpose: regionPurpose,
        });
        console.log(
          `  - Region ID: "${regionId}", Label: "${finalLabel}"${
            regionPurpose ? `, Purpose: "${regionPurpose}"` : ""
          }`
        );
      }

      const successMessage = `Successfully parsed ${foundRegions.length} page regions (page ${currentPage}/${totalPages}).`;
      return {
        success: true,
        message: successMessage,
        data: {
          elements: foundRegions,
          pagination: {
            totalElements,
            currentPage,
            totalPages,
            hasMore,
            nextStartIndex,
          },
        },
      };
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

  private async findStatusMessageAreasInternal(
    startIndex: number = 0,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      elements: StatusMessageAreaInfo[];
      pagination: {
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
    }>
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
      const totalElements = await areaLocator.count();
      console.log(`Found ${totalElements} status message area(s).`);

      // Calculate pagination
      const totalPages = Math.ceil(totalElements / pageSize);
      const currentPage = Math.floor(startIndex / pageSize) + 1;
      const endIndex = Math.min(startIndex + pageSize, totalElements);
      const hasMore = endIndex < totalElements;
      const nextStartIndex = hasMore ? endIndex : undefined;

      const foundAreas: StatusMessageAreaInfo[] = [];

      console.log(
        `Processing status message areas ${
          startIndex + 1
        }-${endIndex} of ${totalElements} (page ${currentPage}/${totalPages})...`
      );

      for (let i = startIndex; i < endIndex; i++) {
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

      const successMessage = `Successfully parsed ${foundAreas.length} status message areas (page ${currentPage}/${totalPages}).`;
      return {
        success: true,
        message: successMessage,
        data: {
          elements: foundAreas,
          pagination: {
            totalElements,
            currentPage,
            totalPages,
            hasMore,
            nextStartIndex,
          },
        },
      };
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

  private async findLoadingIndicatorsInternal(
    startIndex: number = 0,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      elements: LoadingIndicatorInfo[];
      pagination: {
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
    }>
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
      const totalElements = await indicatorLocator.count();
      console.log(`Found ${totalElements} loading indicator(s).`);

      // Calculate pagination
      const totalPages = Math.ceil(totalElements / pageSize);
      const currentPage = Math.floor(startIndex / pageSize) + 1;
      const endIndex = Math.min(startIndex + pageSize, totalElements);
      const hasMore = endIndex < totalElements;
      const nextStartIndex = hasMore ? endIndex : undefined;

      const foundIndicators: LoadingIndicatorInfo[] = [];

      console.log(
        `Processing loading indicators ${
          startIndex + 1
        }-${endIndex} of ${totalElements} (page ${currentPage}/${totalPages})...`
      );

      for (let i = startIndex; i < endIndex; i++) {
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

      const successMessage = `Successfully parsed ${foundIndicators.length} loading indicators (page ${currentPage}/${totalPages}).`;
      return {
        success: true,
        message: successMessage,
        data: {
          elements: foundIndicators,
          pagination: {
            totalElements,
            currentPage,
            totalPages,
            hasMore,
            nextStartIndex,
          },
        },
      };
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

  async getNextElementsPage(
    currentStartIndex: number,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      elements: InteractiveElementInfo[];
      pagination: {
        totalInViewport: number;
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
      scrollInfo: {
        canScrollDown: boolean;
        canScrollUp: boolean;
        isAtTop: boolean;
        isAtBottom: boolean;
      };
    }>
  > {
    const nextStartIndex = currentStartIndex + pageSize;
    return this.getInteractiveElementsWithState(nextStartIndex, pageSize);
  }

  async getPreviousElementsPage(
    currentStartIndex: number,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      elements: InteractiveElementInfo[];
      pagination: {
        totalInViewport: number;
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
      scrollInfo: {
        canScrollDown: boolean;
        canScrollUp: boolean;
        isAtTop: boolean;
        isAtBottom: boolean;
      };
    }>
  > {
    const previousStartIndex = Math.max(0, currentStartIndex - pageSize);
    return this.getInteractiveElementsWithState(previousStartIndex, pageSize);
  }

  async getFirstElementsPage(pageSize: number = 20): Promise<
    ParserResult<{
      elements: InteractiveElementInfo[];
      pagination: {
        totalInViewport: number;
        totalElements: number;
        currentPage: number;
        totalPages: number;
        hasMore: boolean;
        nextStartIndex?: number;
      };
      scrollInfo: {
        canScrollDown: boolean;
        canScrollUp: boolean;
        isAtTop: boolean;
        isAtBottom: boolean;
      };
    }>
  > {
    return this.getInteractiveElementsWithState(0, pageSize);
  }

  // Structured data pagination methods
  async getNextStructuredDataPage(
    currentStartIndex: number,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      containers: DisplayContainerInfo[];
      regions: PageRegionInfo[];
      statusMessages: StatusMessageAreaInfo[];
      loadingIndicators: LoadingIndicatorInfo[];
      pagination: {
        containers: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        regions: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        statusMessages: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        loadingIndicators: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
      };
    }>
  > {
    const nextStartIndex = currentStartIndex + pageSize;
    return this.getStructuredData(nextStartIndex, pageSize);
  }

  async getPreviousStructuredDataPage(
    currentStartIndex: number,
    pageSize: number = 20
  ): Promise<
    ParserResult<{
      containers: DisplayContainerInfo[];
      regions: PageRegionInfo[];
      statusMessages: StatusMessageAreaInfo[];
      loadingIndicators: LoadingIndicatorInfo[];
      pagination: {
        containers: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        regions: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        statusMessages: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        loadingIndicators: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
      };
    }>
  > {
    const previousStartIndex = Math.max(0, currentStartIndex - pageSize);
    return this.getStructuredData(previousStartIndex, pageSize);
  }

  async getFirstStructuredDataPage(pageSize: number = 20): Promise<
    ParserResult<{
      containers: DisplayContainerInfo[];
      regions: PageRegionInfo[];
      statusMessages: StatusMessageAreaInfo[];
      loadingIndicators: LoadingIndicatorInfo[];
      pagination: {
        containers: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        regions: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        statusMessages: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
        loadingIndicators: {
          totalElements: number;
          currentPage: number;
          totalPages: number;
          hasMore: boolean;
          nextStartIndex?: number;
        };
      };
    }>
  > {
    return this.getStructuredData(0, pageSize);
  }
}
