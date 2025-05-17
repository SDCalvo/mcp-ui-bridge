import { PlaywrightController } from "./core/playwright-controller";
import { DomParser } from "./core/dom-parser";
// Importing types for potentially using them in main.ts if we decide to type the results further
import { InteractiveElementInfo, DisplayContainerInfo } from "./types";

const FRONTEND_URL = "http://localhost:5173";

async function main() {
  const controller = new PlaywrightController({ headless: true });
  try {
    await controller.launch();
    await controller.navigate(FRONTEND_URL, { waitUntil: "networkidle" });

    const page = controller.getPage();
    const domParser = new DomParser(page);

    console.log("\n--- Finding Interactive Elements ---");
    const interactiveElements: InteractiveElementInfo[] =
      await domParser.findInteractiveElements();
    console.log(
      `Interactive elements data retrieved: ${interactiveElements.length} items`
    );
    // console.log(JSON.stringify(interactiveElements, null, 2)); // Optional: for more detailed logging

    console.log("\n--- Finding Display Containers ---");
    const displayContainers: DisplayContainerInfo[] =
      await domParser.findDisplayContainers();
    console.log(
      `Display containers data retrieved: ${displayContainers.length} items`
    );
    // console.log(JSON.stringify(displayContainers, null, 2)); // Optional: for more detailed logging
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await controller.close();
  }
}

main()
  .then(() => console.log("\nScript finished."))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1); // Exit with error code if script fails
  });
