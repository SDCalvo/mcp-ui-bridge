import inquirer from "inquirer";
import { PlaywrightController } from "./core/playwright-controller.js";
import { DomParser } from "./core/dom-parser.js";
import { ActionResult, ParserResult } from "./core/types.js";
import {
  InteractiveElementInfo,
  DisplayContainerInfo,
  PageRegionInfo,
  StatusMessageAreaInfo,
  LoadingIndicatorInfo,
} from "./types/index.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function displayCurrentScreenState(domParser: DomParser): Promise<void> {
  console.log("\n\n------------------------------------");
  console.log("--- CURRENT SCREEN STATE ---");
  console.log("------------------------------------");

  const processAndLog = <T>(
    items: T[] | undefined,
    title: string,
    emptyMessage: string,
    itemLogger?: (item: T) => void
  ) => {
    console.log(`\n--- ${title} ---`);
    if (items && items.length > 0) {
      console.log(`${items.length} item(s) found.`);
      if (itemLogger) {
        items.forEach(itemLogger);
      } else {
        items.forEach((item) => console.log(JSON.stringify(item, null, 2)));
      }
    } else {
      console.log(emptyMessage);
    }
  };

  const structuredDataResult = await domParser.getStructuredData();

  if (structuredDataResult.success && structuredDataResult.data) {
    processAndLog<InteractiveElementInfo>(
      await (
        await domParser.getInteractiveElementsWithState()
      ).data,
      "Available Actions (Interactive Elements)",
      "No interactive elements found on the current screen."
    );
    processAndLog<DisplayContainerInfo>(
      structuredDataResult.data.containers,
      "Displayed Data (Display Containers)",
      "No display containers found on the current screen."
    );
    processAndLog<PageRegionInfo>(
      structuredDataResult.data.regions,
      "Page Regions",
      "No page regions found."
    );
    processAndLog<StatusMessageAreaInfo>(
      structuredDataResult.data.statusMessages,
      "Status Message Areas",
      "No status message areas found."
    );
    processAndLog<LoadingIndicatorInfo>(
      structuredDataResult.data.loadingIndicators,
      "Loading Indicators",
      "No loading indicators found."
    );
  } else {
    console.error("Could not retrieve structured data from the page:");
    console.error(structuredDataResult.message || "Unknown parsing error.");
    if (structuredDataResult.errorType) {
      console.error(`Error type: ${structuredDataResult.errorType}`);
    }
  }

  console.log("------------------------------------\n");
}

async function commandLoop(
  controller: PlaywrightController,
  domParser: DomParser
): Promise<void> {
  let running = true;
  interface CommandResponse {
    command: string;
  }

  while (running) {
    await displayCurrentScreenState(domParser);

    const answers: CommandResponse = await inquirer.prompt<CommandResponse>([
      {
        type: "input",
        name: "command",
        message:
          'Enter command (click <id>, type <id> "text", state <id>, scan, quit):',
      },
    ]);

    const commandInput =
      typeof answers.command === "string" ? answers.command.trim() : "";
    const parts = commandInput.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const action = parts[0]?.toLowerCase();
    const elementId = parts[1];
    const textToType = parts[2]?.replace(/^"|"$/g, "");

    let actionResult: ActionResult<any> | null = null;

    switch (action) {
      case "click": {
        if (!elementId) {
          console.log("Please provide an element ID to click.");
          break;
        }
        const result = await controller.click(elementId);
        actionResult = result;
        if (result.success) {
          console.log(result.message || `Clicked element: ${elementId}.`);
        } else {
          console.error(`Click failed: ${result.message || "Unknown error."}`);
          if (result.errorType)
            console.error(`Error type: ${result.errorType}`);
        }
        break;
      }
      case "type": {
        if (!elementId || textToType === undefined) {
          console.log(
            'Please provide an element ID and text to type (e.g., type my-input "hello").'
          );
          break;
        }
        const result = await controller.type(elementId, textToType);
        actionResult = result;
        if (result.success) {
          console.log(result.message || `Typed into element: ${elementId}.`);
        } else {
          console.error(`Type failed: ${result.message || "Unknown error."}`);
          if (result.errorType)
            console.error(`Error type: ${result.errorType}`);
        }
        break;
      }
      case "state": {
        if (!elementId) {
          console.log("Please provide an element ID to get its state.");
          break;
        }
        const result = await controller.getElementState(elementId);
        if (result.success && result.data) {
          console.log(`State for element '${elementId}':`);
          console.log(JSON.stringify(result.data, null, 2));
        } else if (result.success && !result.data) {
          console.log(
            `Element with ID '${elementId}' found, but no specific state details returned.`
          );
        } else {
          console.error(
            `Get state failed: ${result.message || "Unknown error."}`
          );
          if (result.errorType)
            console.error(`Error type: ${result.errorType}`);
        }
        break;
      }
      case "scan":
        console.log(
          "Re-scanning page (current state will be displayed next)..."
        );
        break;
      case "quit":
        running = false;
        console.log("Exiting...");
        break;
      default:
        console.log(
          'Unknown command. Available: click <id>, type <id> "text", state <id>, scan, quit'
        );
    }
    if (actionResult) {
      if (!actionResult.success) {
        console.log(
          "Action failed. State will be refreshed. Consider using 'scan' if UI is not as expected."
        );
      }
    } else if (!["scan", "quit", "state"].includes(action || "")) {
      console.log("Command processed. State will be refreshed.");
    }
  }
}

async function main() {
  const controller = new PlaywrightController({ headless: false });
  let domParser: DomParser | null = null;

  try {
    const launchResult = await controller.launch();
    if (!launchResult.success) {
      console.error("Failed to launch browser:", launchResult.message);
      if (launchResult.errorType)
        console.error(`Error type: ${launchResult.errorType}`);
      await controller.close();
      return;
    }
    console.log(launchResult.message);

    const navigateResult = await controller.navigate(FRONTEND_URL, {
      waitUntil: "networkidle",
    });
    if (!navigateResult.success) {
      console.error(
        `Failed to navigate to ${FRONTEND_URL}:`,
        navigateResult.message
      );
      if (navigateResult.errorType)
        console.error(`Error type: ${navigateResult.errorType}`);
    } else {
      console.log(navigateResult.message);
    }

    domParser = new DomParser(controller.getPage());

    await commandLoop(controller, domParser);
  } catch (error: any) {
    console.error(
      "A critical error occurred in main execution:",
      error.message
    );
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    console.log("Closing browser...");
    const closeResult = await controller.close();
    if (!closeResult.success) {
      console.error("Failed to close browser cleanly:", closeResult.message);
      if (closeResult.errorType)
        console.error(`Error type: ${closeResult.errorType}`);
    } else {
      console.log(closeResult.message || "Browser closed.");
    }
    console.log("Script finished.");
  }
}

main().catch((e) => {
  console.error("Unhandled promise rejection in main catch-all:", e);
  process.exit(1);
});
