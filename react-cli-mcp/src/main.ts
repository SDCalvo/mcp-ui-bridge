import inquirer from "inquirer";
import {
  PlaywrightController,
  ActionResult,
} from "./core/playwright-controller";
import { DomParser, ParserResult } from "./core/dom-parser";
// Importing types for potentially using them in main.ts if we decide to type the results further
// import {
//   InteractiveElementInfo,
//   DisplayContainerInfo,
//   PageRegionInfo,
//   StatusMessageAreaInfo,
//   LoadingIndicatorInfo,
// } from "./types"; // Not strictly needed here as types are inferred by processParserResult

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function displayCurrentScreenState(domParser: DomParser): Promise<void> {
  console.log("\n\n------------------------------------");
  console.log("--- CURRENT SCREEN STATE ---");
  console.log("------------------------------------");

  // Helper to process and log parser results
  const processParserResult = <T>(
    result: ParserResult<T[]>,
    title: string,
    emptyMessage: string
  ) => {
    console.log(`\n--- ${title} ---`);
    if (result.success && result.data) {
      if (result.data.length > 0) {
        console.log(result.message || `${result.data.length} item(s) found.`);
      } else {
        console.log(emptyMessage);
      }
    } else if (result.success && !result.data) {
      console.log(emptyMessage);
    } else {
      console.error(`Error parsing ${title.toLowerCase()}: ${result.message}`);
      if (result.errorType) {
        console.error(`Error type: ${result.errorType}`);
      }
    }
  };

  // Corrected: No explicit type annotation needed, it will be ParserResult<InteractiveElementInfo[]>
  const interactiveElementsResult = await domParser.findInteractiveElements();
  processParserResult(
    interactiveElementsResult,
    "Available Actions (Interactive Elements)",
    "No interactive elements found on the current screen."
  );

  // Corrected: No explicit type annotation needed
  const displayContainersResult = await domParser.findDisplayContainers();
  processParserResult(
    displayContainersResult,
    "Displayed Data (Display Containers)",
    "No display containers found on the current screen."
  );

  // Corrected: No explicit type annotation needed
  const pageRegionsResult = await domParser.findPageRegions();
  processParserResult(
    pageRegionsResult,
    "Page Regions",
    "No page regions found."
  );

  // Corrected: No explicit type annotation needed
  const statusMessagesResult = await domParser.findStatusMessageAreas();
  processParserResult(
    statusMessagesResult,
    "Status Message Areas",
    "No status message areas found."
  );

  // Corrected: No explicit type annotation needed
  const loadingIndicatorsResult = await domParser.findLoadingIndicators();
  processParserResult(
    loadingIndicatorsResult,
    "Loading Indicators",
    "No loading indicators found."
  );

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

    let actionResult: ActionResult | null = null;

    switch (action) {
      case "click":
        if (!elementId) {
          console.log("Please provide an element ID to click.");
          break;
        }
        actionResult = await controller.clickElement(elementId);
        if (actionResult.success) {
          console.log(actionResult.message || `Clicked element: ${elementId}.`);
        } else {
          console.error(
            `Click failed: ${actionResult.message || "Unknown error."}`
          );
          if (actionResult.errorType)
            console.error(`Error type: ${actionResult.errorType}`);
        }
        break;
      case "type":
        if (!elementId || textToType === undefined) {
          console.log(
            'Please provide an element ID and text to type (e.g., type my-input "hello").'
          );
          break;
        }
        actionResult = await controller.typeInElement(elementId, textToType);
        if (actionResult.success) {
          console.log(
            actionResult.message || `Typed into element: ${elementId}.`
          );
        } else {
          console.error(
            `Type failed: ${actionResult.message || "Unknown error."}`
          );
          if (actionResult.errorType)
            console.error(`Error type: ${actionResult.errorType}`);
        }
        break;
      case "state":
        if (!elementId) {
          console.log("Please provide an element ID to get its state.");
          break;
        }
        const stateResult = await controller.getElementState(elementId);
        if (stateResult.success && stateResult.data) {
          console.log(`State for element '${elementId}':`);
          console.log(JSON.stringify(stateResult.data, null, 2));
        } else if (stateResult.success && !stateResult.data) {
          console.log(
            `Element with ID '${elementId}' found, but no specific state details returned.`
          );
        } else {
          console.error(
            `Get state failed: ${stateResult.message || "Unknown error."}`
          );
          if (stateResult.errorType)
            console.error(`Error type: ${stateResult.errorType}`);
        }
        break;
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
    if (actionResult && !actionResult.success) {
      console.log(
        "Action failed. State will be refreshed. Consider using 'scan' if UI is not as expected."
      );
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
