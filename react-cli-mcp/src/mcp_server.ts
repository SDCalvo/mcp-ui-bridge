import { FastMCP } from "fastmcp";
import { z } from "zod";
import { PlaywrightController } from "./core/playwright-controller.js";
import { DomParser } from "./core/dom-parser.js";
// Page import is not directly used at the top level after refactor, PlaywrightController handles it.
// import { Page } from "playwright";
import { InteractiveElementInfo } from "./types/index.js";
import {
  ActionResult,
  ParserResult,
  PlaywrightErrorType,
} from "./core/types.js";
import { pathToFileURL } from "url";
import { resolve } from "path";

console.log("[mcp_server.ts] Initializing FastMCP server logic...");

// --- Configuration Interface ---
export interface McpServerOptions {
  targetUrl: string;
  headlessBrowser: boolean;
  mcpPort: number;
  mcpSseEndpoint: `/${string}`;
  serverName?: string;
  serverVersion?: `${number}.${number}.${number}`;
  serverInstructions?: string;
}

// --- Global Instances ---
// These will be initialized by runMcpServer via initializeBrowserAndDependencies
let playwrightController: PlaywrightController | null = null;
let domParser: DomParser | null = null;

// --- Core Server Function ---
async function initializeBrowserAndDependencies(
  options: Pick<McpServerOptions, "headlessBrowser" | "targetUrl">
): Promise<void> {
  console.log(
    `[mcp_server.ts] Initializing PlaywrightController (Headless: ${options.headlessBrowser})...`
  );
  playwrightController = new PlaywrightController({
    headless: options.headlessBrowser,
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
    console.error(
      "[mcp_server.ts] CRITICAL: Page not available after successful browser launch."
    );
    throw new Error("Page not available after browser launch.");
  }

  console.log(
    `[mcp_server.ts] Navigating to target URL: ${options.targetUrl}...`
  );
  const navResult = await playwrightController.navigate(options.targetUrl);
  if (!navResult.success) {
    console.error(
      `[mcp_server.ts] CRITICAL: Failed to navigate to ${options.targetUrl}.`,
      navResult.message
    );
    await playwrightController.close();
    throw new Error(
      `Failed to navigate to ${options.targetUrl}: ${
        navResult.message || "Unknown error"
      }`
    );
  }
  console.log(
    `[mcp_server.ts] Successfully navigated to ${options.targetUrl}.`
  );

  domParser = new DomParser(pageInstance);
  console.log("[mcp_server.ts] DomParser initialized.");
  console.log(
    "[mcp_server.ts] Browser and dependencies initialized successfully."
  );
}

// --- MCP Server Instance ---
// Server instance is now created within runMcpServer
let server: FastMCP | null = null;

// --- Tool Definitions ---
// These functions will add tools to the server instance when it's created.
function addCoreTools(mcpServer: FastMCP) {
  // Get Current Screen Data Tool
  mcpServer.addTool({
    name: "get_current_screen_data",
    description:
      "Gets the current structured data and interactive elements displayed on the screen.",
    parameters: undefined, // Switched to undefined as per FastMCP examples for no-param tools
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
        console.error(
          "[mcp_server.ts] Error in get_current_screen_data:",
          error
        );
        return JSON.stringify({
          success: false,
          message: `Error fetching screen data: ${error.message}`,
          errorType: PlaywrightErrorType.ActionFailed,
        });
      }
    },
  });

  // Get Current Screen Actions Tool
  mcpServer.addTool({
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

  mcpServer.addTool({
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
          message:
            "PlaywrightController not initialized or page not available.",
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
}

// --- New Core Server Function ---
export async function runMcpServer(options: McpServerOptions): Promise<void> {
  try {
    console.log("[mcp_server.ts] Starting runMcpServer with options:", options);
    await initializeBrowserAndDependencies({
      headlessBrowser: options.headlessBrowser,
      targetUrl: options.targetUrl,
    });

    server = new FastMCP({
      name: options.serverName || "ReactCliConversorServer",
      version: options.serverVersion || "1.0.3", // Default to a valid X.Y.Z format
      instructions:
        options.serverInstructions ||
        "This server interacts with a React web application. Use get_current_screen_data to see the page, get_current_screen_actions for possible interactions, and send_command to perform actions like 'click #id' or 'type #id \"text\"'.",
    });

    addCoreTools(server); // Add the defined tools to this server instance

    console.log(
      `[mcp_server.ts] Attempting to start FastMCP server with SSE transport on port ${options.mcpPort}, endpoint ${options.mcpSseEndpoint}...`
    );
    server.start({
      transportType: "sse",
      sse: {
        port: options.mcpPort,
        endpoint: options.mcpSseEndpoint,
      },
    });
    console.log(
      `[mcp_server.ts] FastMCP Server started successfully with SSE on port ${options.mcpPort}, endpoint ${options.mcpSseEndpoint}.`
    );
    console.log(
      `[mcp_server.ts] Target React app should be accessible at ${options.targetUrl}.`
    );
  } catch (error) {
    console.error(
      "[mcp_server.ts] CRITICAL: Failed to initialize or start FastMCP server in runMcpServer:",
      error
    );
    if (playwrightController) {
      console.log(
        "[mcp_server.ts] Attempting to close Playwright browser due to error in runMcpServer..."
      );
      await playwrightController.close().catch((closeError) => {
        console.error(
          "[mcp_server.ts] Error closing Playwright browser during cleanup:",
          closeError
        );
      });
    }
    // When used as a library, we might want to re-throw or handle error differently
    // For now, if main() calls this, process.exit will be handled there.
    // If called as a library, the caller should handle this promise rejection.
    throw error;
  }
}

// --- Main Execution Logic (for direct script execution) ---
async function main() {
  // Configuration resolution: Env Vars > Defaults
  const targetUrl = process.env.MCP_TARGET_URL || "http://localhost:5173";
  const headlessBrowser =
    (process.env.MCP_HEADLESS_BROWSER || "false").toLowerCase() === "true";
  const mcpPort = parseInt(process.env.MCP_PORT || "3000", 10);

  let mcpSseEndpoint = process.env.MCP_SSE_ENDPOINT || "/mcp/sse";
  if (!mcpSseEndpoint.startsWith("/")) {
    mcpSseEndpoint = "/" + mcpSseEndpoint;
  }
  const finalSseEndpoint = mcpSseEndpoint as `/${string}`;

  // Validate or default MCP_SERVER_VERSION
  let serverVersionFromEnv = process.env.MCP_SERVER_VERSION;
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (serverVersionFromEnv && !versionRegex.test(serverVersionFromEnv)) {
    console.warn(
      `[mcp_server.ts] Invalid MCP_SERVER_VERSION format: "${serverVersionFromEnv}". Using default "1.0.3".`
    );
    serverVersionFromEnv = undefined; // Use default if format is wrong
  }

  const options: McpServerOptions = {
    targetUrl,
    headlessBrowser,
    mcpPort,
    mcpSseEndpoint: finalSseEndpoint,
    serverName: process.env.MCP_SERVER_NAME || "ReactCliConversorServerEnv",
    serverVersion:
      (serverVersionFromEnv as `${number}.${number}.${number}`) || "1.0.3",
    serverInstructions: process.env.MCP_SERVER_INSTRUCTIONS, // Will use FastMCP default if undefined
  };

  try {
    await runMcpServer(options);
    // Keep alive, server.start is non-blocking for SSE
    console.log("[mcp_server.ts] Main function completed, server is running.");
  } catch (error) {
    console.error("[mcp_server.ts] Error in main execution:", error);
    process.exit(1); // Exit if server fails to start
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

// Only run main() if the script is executed directly
// ESM-compatible way to check if the script is the main module
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Ctrl+C
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // kill
  process.on("SIGQUIT", () => gracefulShutdown("SIGQUIT")); // Ctrl+\
  main();
}

// To ensure this file is treated as a module and allow exporting McpServerOptions and runMcpServer.
export {};
