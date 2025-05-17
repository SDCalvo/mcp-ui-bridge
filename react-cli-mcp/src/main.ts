import inquirer from "inquirer";
import { PlaywrightController } from "./core/playwright-controller";
import { DomParser } from "./core/dom-parser";
// Importing types for potentially using them in main.ts if we decide to type the results further
import {
  InteractiveElementInfo,
  DisplayContainerInfo,
  PageRegionInfo,
  StatusMessageAreaInfo,
  LoadingIndicatorInfo,
} from "./types";

const FRONTEND_URL = "http://localhost:5173";

async function displayCurrentScreenState(
  domParser: DomParser
  // controller is not used in this function, can be removed if not needed elsewhere for it
): Promise<void> {
  console.log("\n\n------------------------------------");
  console.log("--- CURRENT SCREEN STATE ---");
  console.log("------------------------------------");

  try {
    // Get interactive elements
    // DomParser.findInteractiveElements() already logs details.
    const interactiveElements: InteractiveElementInfo[] =
      await domParser.findInteractiveElements();
    if (interactiveElements.length === 0) {
      console.log("\n--- Available Actions (Interactive Elements) ---");
      console.log("No interactive elements found on the current screen.");
    }

    // Get display containers
    // DomParser.findDisplayContainers() already logs details.
    const displayContainers: DisplayContainerInfo[] =
      await domParser.findDisplayContainers();
    if (displayContainers.length === 0) {
      console.log("\n--- Displayed Data (Display Containers) ---");
      console.log("No display containers found on the current screen.");
    }

    // Get Page Regions
    // DomParser.findPageRegions() already logs details.
    const pageRegions: PageRegionInfo[] = await domParser.findPageRegions();
    if (pageRegions.length === 0) {
      console.log("\n--- Page Regions ---");
      console.log("No page regions found.");
    }

    // Get Status Message Areas
    // DomParser.findStatusMessageAreas() already logs details.
    const statusMessages: StatusMessageAreaInfo[] =
      await domParser.findStatusMessageAreas();
    if (statusMessages.length === 0) {
      console.log("\n--- Status Message Areas ---");
      console.log("No status message areas found.");
    }

    // Get Loading Indicators
    // DomParser.findLoadingIndicators() already logs details.
    const loadingIndicators: LoadingIndicatorInfo[] =
      await domParser.findLoadingIndicators();
    if (loadingIndicators.length === 0) {
      console.log("\n--- Loading Indicators ---");
      console.log("No loading indicators found.");
    }
  } catch (error) {
    console.error("Error getting current screen state:", error);
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

    const { command }: CommandResponse = await inquirer.prompt<CommandResponse>(
      [
        {
          type: "input",
          name: "command",
          message:
            'Enter command (click <id>, type <id> "text", state <id>, scan, quit):',
        },
      ]
    );

    // Ensure command is a string and then attempt to match.
    const commandInput = typeof command === "string" ? command.trim() : "";
    const parts = commandInput.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const action = parts[0]?.toLowerCase();
    const elementId = parts[1];
    const textToType = parts[2] ? parts[2].replace(/^"|"$/g, "") : undefined;

    try {
      switch (action) {
        case "click":
          if (!elementId) {
            console.log("Please provide an element ID to click.");
            break;
          }
          await controller.clickElement(elementId);
          console.log(
            `Clicked element: ${elementId}. The page state will refresh. If this refreshed state doesn't fully reflect the expected outcome (e.g., for asynchronous operations), use the 'scan' command to get the absolute latest state.`
          );
          break;
        case "type":
          if (!elementId || textToType === undefined) {
            console.log(
              'Please provide an element ID and text to type (e.g., type my-input "hello").'
            );
            break;
          }
          await controller.typeInElement(elementId, textToType);
          console.log(
            `Typed "${textToType}" into element: ${elementId}. The page state will refresh. If this refreshed state doesn't fully reflect the expected outcome (e.g., for asynchronous operations), use the 'scan' command to get the absolute latest state.`
          );
          break;
        case "state":
          if (!elementId) {
            console.log("Please provide an element ID to get its state.");
            break;
          }
          const state = await controller.getElementState(elementId);
          if (state) {
            // getElementState already logs the state
          } else {
            console.log(`Could not retrieve state for element: ${elementId}`);
          }
          break;
        case "scan":
          // displayCurrentScreenState is called at the beginning of the loop
          console.log("Re-scanning page...");
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
    } catch (error) {
      console.error(`Error executing command "${action}":`, error);
    }
    if (
      action !== "scan" &&
      action !== "state" &&
      action !== "quit" &&
      running
    ) {
      // Automatically refresh state after actions that might change the UI
      // but not after scan, state, or quit.
      console.log("Refreshing screen state after action...");
      // Small delay to allow UI to settle, if necessary.
      // await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

async function main() {
  // To see the browser, set headless: false. Default is true (no UI).
  const controller = new PlaywrightController({ headless: false });
  try {
    await controller.launch();
    await controller.navigate(FRONTEND_URL, { waitUntil: "networkidle" });

    const page = controller.getPage();
    const domParser = new DomParser(page);

    // Initial display of screen state is handled by the commandLoop
    await commandLoop(controller, domParser);
  } catch (error) {
    console.error("An critical error occurred in main execution:", error);
  } finally {
    await controller.close();
    console.log("Script finished.");
  }
}

main().catch((e) => {
  console.error("Unhandled promise rejection in main:", e);
  process.exit(1);
});
