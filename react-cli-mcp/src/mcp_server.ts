import { FastMCP } from "fastmcp";
import { z } from "zod";
import { PlaywrightController } from "./core/playwright-controller.js";
import { DomParser } from "./core/dom-parser.js";
import { Page } from "playwright";
import { InteractiveElementInfo } from "./types/index.js";
import {
  ActionResult,
  ParserResult,
  PlaywrightErrorType,
} from "./core/types.js";

console.log("[mcp_server.ts] Initializing FastMCP server logic...");

// --- Configuration ---
const TARGET_URL = process.env.MCP_TARGET_URL || "http://localhost:5173";
const HEADLESS_BROWSER =
  (process.env.MCP_HEADLESS_BROWSER || "true").toLowerCase() === "true";
const MCP_PORT = parseInt(process.env.MCP_PORT || "3000", 10);
let MCP_SSE_ENDPOINT = process.env.MCP_SSE_ENDPOINT || "/mcp/sse";

// Ensure MCP_SSE_ENDPOINT starts with a slash for FastMCP typings
if (!MCP_SSE_ENDPOINT.startsWith("/")) {
  MCP_SSE_ENDPOINT = "/" + MCP_SSE_ENDPOINT;
}
const finalSseEndpoint = MCP_SSE_ENDPOINT as `/${string}`;

// --- Global Instances ---
// These will be initialized by initializeBrowserAndDependencies
let playwrightController: PlaywrightController | null = null;
let domParser: DomParser | null = null;
// page is not strictly needed globally if domParser is always used with its own page ref,
// but playwrightController holds the page.

// --- Initialization Function ---
async function initializeBrowserAndDependencies(): Promise<void> {
  console.log(
    `[mcp_server.ts] Initializing PlaywrightController (Headless: ${HEADLESS_BROWSER})...`
  );
  playwrightController = new PlaywrightController({
    headless: HEADLESS_BROWSER,
  });

  const launchResult = await playwrightController.launch();
  if (!launchResult.success || !playwrightController.getPage()) {
    console.error(
      "[mcp_server.ts] CRITICAL: Failed to launch browser via PlaywrightController.",
      launchResult.message
    );
    throw new Error(
      `Failed to launch browser: ${launchResult.message || "Unknown error"}`
    );
  }
  console.log("[mcp_server.ts] Playwright browser launched.");

  const pageInstance = playwrightController.getPage();
  if (!pageInstance) {
    // This case should be covered by launchResult.success check, but good for type safety
    console.error(
      "[mcp_server.ts] CRITICAL: Page not available after successful browser launch."
    );
    throw new Error("Page not available after browser launch.");
  }

  console.log(`[mcp_server.ts] Navigating to target URL: ${TARGET_URL}...`);
  const navResult = await playwrightController.navigate(TARGET_URL);
  if (!navResult.success) {
    console.error(
      `[mcp_server.ts] CRITICAL: Failed to navigate to ${TARGET_URL}.`,
      navResult.message
    );
    await playwrightController.close(); // Attempt to clean up
    throw new Error(
      `Failed to navigate to ${TARGET_URL}: ${
        navResult.message || "Unknown error"
      }`
    );
  }
  console.log(`[mcp_server.ts] Successfully navigated to ${TARGET_URL}.`);

  domParser = new DomParser(pageInstance);
  console.log("[mcp_server.ts] DomParser initialized.");
  console.log(
    "[mcp_server.ts] Browser and dependencies initialized successfully."
  );
}

// --- MCP Server Instance ---
const server = new FastMCP({
  name: "ReactCliConversorServer",
  version: "1.0.2", // Incremented version
  instructions:
    "This server interacts with a React web application. Use get_current_screen_data to see the page, get_current_screen_actions for possible interactions, and send_command to perform actions like 'click #id' or 'type #id \"text\"'.",
});

// --- Tool Definitions ---

// Get Current Screen Data Tool
server.addTool({
  name: "get_current_screen_data",
  description:
    "Gets the current structured data and interactive elements displayed on the screen.",
  parameters: undefined,
  execute: async () => {
    if (
      !domParser ||
      !playwrightController ||
      !playwrightController.getPage()
    ) {
      console.error(
        "[mcp_server.ts] get_current_screen_data: DomParser or PlaywrightController not initialized."
      );
      return JSON.stringify({
        success: false,
        message: "Server components not initialized.",
        errorType: PlaywrightErrorType.NotInitialized,
      });
    }
    console.log("[mcp_server.ts] get_current_screen_data: Fetching data...");
    try {
      // Check for page navigation state (e.g. if page is closed)
      if (playwrightController.getPage()?.isClosed()) {
        return JSON.stringify({
          success: false,
          message: "Page is closed. Cannot retrieve screen data.",
          errorType: PlaywrightErrorType.PageNotAvailable,
        });
      }

      const structuredDataResult = await domParser.getStructuredData();
      const interactiveElementsResult =
        await domParser.getInteractiveElementsWithState();

      return JSON.stringify({
        success: true,
        currentUrl: playwrightController.getPage()?.url(),
        data: {
          structuredData: structuredDataResult.data || {
            containers: [],
            regions: [],
            statusMessages: [],
            loadingIndicators: [],
          },
          interactiveElements: interactiveElementsResult.data || [],
        },
        parserMessages: {
          structured: structuredDataResult.message,
          interactive: interactiveElementsResult.message,
        },
      });
    } catch (error: any) {
      console.error("[mcp_server.ts] Error in get_current_screen_data:", error);
      return JSON.stringify({
        success: false,
        message: `Error fetching screen data: ${error.message}`,
        errorType: PlaywrightErrorType.ActionFailed,
      });
    }
  },
});

// Get Current Screen Actions Tool
server.addTool({
  name: "get_current_screen_actions",
  description:
    "Gets a list of available actions based on interactive elements on the current screen.",
  parameters: undefined,
  execute: async () => {
    if (
      !domParser ||
      !playwrightController ||
      !playwrightController.getPage()
    ) {
      console.error(
        "[mcp_server.ts] get_current_screen_actions: DomParser or PlaywrightController not initialized."
      );
      return JSON.stringify({
        success: false,
        message: "Server components not initialized.",
        actions: [],
        errorType: PlaywrightErrorType.NotInitialized,
      });
    }
    console.log(
      "[mcp_server.ts] get_current_screen_actions: Fetching actions..."
    );

    if (playwrightController.getPage()?.isClosed()) {
      return JSON.stringify({
        success: false,
        message: "Page is closed. Cannot retrieve screen actions.",
        errorType: PlaywrightErrorType.PageNotAvailable,
        actions: [],
      });
    }

    try {
      const interactiveElementsResult =
        await domParser.getInteractiveElementsWithState();
      if (
        !interactiveElementsResult.success ||
        !interactiveElementsResult.data
      ) {
        return JSON.stringify({
          success: false,
          message: `Failed to get interactive elements: ${interactiveElementsResult.message}`,
          actions: [],
          errorType:
            interactiveElementsResult.errorType ||
            PlaywrightErrorType.ActionFailed,
        });
      }

      const actions = interactiveElementsResult.data.map(
        (el: InteractiveElementInfo) => {
          let commandHint = "";
          if (
            el.elementType?.startsWith("input-") &&
            el.elementType !== "input-button" &&
            el.elementType !== "input-submit" &&
            el.elementType !== "input-checkbox" &&
            el.elementType !== "input-radio"
          ) {
            commandHint = `type #${el.id} "your text"`;
          } else {
            commandHint = `click #${el.id}`;
          }
          return {
            id: el.id,
            label: el.label,
            elementType: el.elementType,
            purpose: el.purpose,
            commandHint: commandHint,
            currentValue: el.currentValue,
            isChecked: el.isChecked,
            isDisabled: el.isDisabled,
            isReadOnly: el.isReadOnly,
          };
        }
      );

      return JSON.stringify({ success: true, actions });
    } catch (error: any) {
      console.error(
        "[mcp_server.ts] Error in get_current_screen_actions:",
        error
      );
      return JSON.stringify({
        success: false,
        message: `Error fetching screen actions: ${error.message}`,
        actions: [],
        errorType: PlaywrightErrorType.ActionFailed,
      });
    }
  },
});

// Send Command Tool - Using Zod for parameters
const SendCommandParamsSchema = z.object({
  command_string: z
    .string()
    .describe(
      "The command string to be executed, e.g., 'click #buttonId' or 'type #inputId \"your text\"' (ensure text is quoted if it contains spaces)"
    ),
});

server.addTool({
  name: "send_command",
  description:
    "Sends a command to interact with the web page (e.g., click, type).",
  parameters: SendCommandParamsSchema,
  execute: async (args: z.infer<typeof SendCommandParamsSchema>) => {
    if (!playwrightController || !playwrightController.getPage()) {
      console.error(
        "[mcp_server.ts] send_command: PlaywrightController not initialized or page not available."
      );
      return JSON.stringify({
        success: false,
        message: "PlaywrightController not initialized or page not available.",
        errorType: PlaywrightErrorType.NotInitialized,
      });
    }
    console.log(
      `[mcp_server.ts] send_command: Received raw command_string: '${args.command_string}'`
    );

    if (playwrightController.getPage()?.isClosed()) {
      return JSON.stringify({
        success: false,
        message: "Page is closed. Cannot send command.",
        errorType: PlaywrightErrorType.PageNotAvailable,
      });
    }

    const commandParts = args.command_string.match(/(?:[^\s"]+|"[^"]*")+/g);

    if (!commandParts || commandParts.length < 2) {
      const msg = `Invalid command string format: '${args.command_string}'. Expected 'action #id [params...]'.`;
      console.error(`[mcp_server.ts] send_command: ${msg}`);
      return JSON.stringify({
        success: false,
        message: msg,
        errorType: "InvalidCommandFormat",
      });
    }

    const action = commandParts[0].toLowerCase();
    const elementId = commandParts[1].startsWith("#")
      ? commandParts[1].substring(1)
      : commandParts[1];

    let result: ActionResult;

    try {
      switch (action) {
        case "click":
          if (commandParts.length !== 2) {
            const msg = `Invalid 'click' command format: '${args.command_string}'. Expected 'click #id'.`;
            console.error(`[mcp_server.ts] send_command: ${msg}`);
            return JSON.stringify({
              success: false,
              message: msg,
              errorType: "InvalidCommandFormat",
            });
          }
          console.log(
            `[mcp_server.ts] Executing 'click' on element ID: ${elementId}`
          );
          result = await playwrightController.click(elementId);
          break;
        case "type":
          if (commandParts.length !== 3) {
            const msg = `Invalid 'type' command format: '${args.command_string}'. Expected 'type #id "text"'.`;
            console.error(`[mcp_server.ts] send_command: ${msg}`);
            return JSON.stringify({
              success: false,
              message: msg,
              errorType: "InvalidCommandFormat",
            });
          }
          let textToType = commandParts[2];
          if (textToType.startsWith('"') && textToType.endsWith('"')) {
            textToType = textToType.substring(1, textToType.length - 1);
          }
          console.log(
            `[mcp_server.ts] Executing 'type' in element ID: ${elementId} with text: "${textToType}"`
          );
          result = await playwrightController.type(elementId, textToType);
          break;
        default:
          const msg = `Unsupported action: '${action}'. Supported actions are 'click', 'type'.`;
          console.error(`[mcp_server.ts] send_command: ${msg}`);
          return JSON.stringify({
            success: false,
            message: msg,
            errorType: "UnsupportedAction",
          });
      }
      console.log(
        `[mcp_server.ts] Command '${action}' execution result:`,
        result
      );
      return JSON.stringify(result);
    } catch (error: any) {
      console.error(
        `[mcp_server.ts] Error executing command '${args.command_string}':`,
        error
      );
      return JSON.stringify({
        success: false,
        message: `Error during command execution: ${error.message}`,
        errorType: PlaywrightErrorType.ActionFailed,
      });
    }
  },
});

// --- Main Execution Logic ---
async function main() {
  try {
    console.log("[mcp_server.ts] Starting main execution...");
    await initializeBrowserAndDependencies();

    console.log(
      `[mcp_server.ts] Attempting to start FastMCP server with SSE transport on port ${MCP_PORT}, endpoint ${finalSseEndpoint}...`
    );
    server.start({
      transportType: "sse",
      sse: {
        port: MCP_PORT,
        endpoint: finalSseEndpoint,
      },
    });
    console.log(
      `[mcp_server.ts] FastMCP Server started successfully with SSE on port ${MCP_PORT}, endpoint ${finalSseEndpoint}.`
    );
    console.log(
      `[mcp_server.ts] Target React app should be accessible at ${TARGET_URL}.`
    );
  } catch (error) {
    console.error(
      "[mcp_server.ts] CRITICAL: Failed to initialize or start FastMCP server:",
      error
    );
    if (playwrightController) {
      console.log(
        "[mcp_server.ts] Attempting to close Playwright browser due to error..."
      );
      await playwrightController.close().catch((closeError) => {
        console.error(
          "[mcp_server.ts] Error closing Playwright browser during cleanup:",
          closeError
        );
      });
    }
    process.exit(1);
  }
}

// Graceful shutdown
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(
    `\n[mcp_server.ts] Received ${signal}. Starting graceful shutdown...`
  );

  // FastMCP server itself doesn't have an explicit server.stop() in the version used by docs.
  // We'll focus on cleaning up resources like Playwright.

  if (playwrightController) {
    console.log("[mcp_server.ts] Closing Playwright browser...");
    try {
      await playwrightController.close();
      console.log("[mcp_server.ts] Playwright browser closed successfully.");
    } catch (error) {
      console.error("[mcp_server.ts] Error closing Playwright browser:", error);
    }
  }

  console.log("[mcp_server.ts] Graceful shutdown completed. Exiting.");
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Ctrl+C
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // kill
process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT")); // Ctrl+\

main(); // Call the main async function

// To ensure this file is treated as a module, especially if no other exports are present.
export {};
