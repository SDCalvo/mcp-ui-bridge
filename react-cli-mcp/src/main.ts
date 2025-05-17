import { PlaywrightController } from "./core/playwright-controller";
import { DomParser } from "./core/dom-parser";

const FRONTEND_URL = "http://localhost:5173";

async function main() {
  const controller = new PlaywrightController({ headless: true });
  try {
    await controller.launch();
    await controller.navigate(FRONTEND_URL, { waitUntil: "networkidle" });

    const page = controller.getPage();
    const domParser = new DomParser(page);

    console.log("--- Finding Interactive Elements ---");
    const interactiveElements = await domParser.findInteractiveElements();
    // For now, we're just logging within the method.
    // Later, we can use the 'interactiveElements' array here.
    console.log(
      `Interactive elements data retrieved: ${interactiveElements.length} items`
    );

    // TODO:
    // 1. Call DomParser method to find display elements (data-display-container / data-display-item-text)
    // 2. Log basic information about these display elements.
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await controller.close();
  }
}

main()
  .then(() => console.log("Script finished."))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1); // Exit with error code if script fails
  });
