import { FastMCP } from "fastmcp";
import { z } from "zod";
import { PlaywrightController } from "./core/playwright-controller.js";
import { DomParser } from "./core/dom-parser.js";
import {
  InteractiveElementInfo,
  ActionResult,
  PlaywrightErrorType,
  McpServerOptions,
  ClientAuthContext,
  AuthenticateClientCallback,
  CustomAttributeReader,
} from "./types/index.js";
import { pathToFileURL } from "url";
import { resolve } from "path";

// Explicitly re-export the types needed by consumers of the library
export {
  McpServerOptions,
  ClientAuthContext,
  type AuthenticateClientCallback,
  type CustomAttributeReader,
};

console.log("[mcp_server.ts] Initializing FastMCP server logic...");

// --- Global Instances ---
// These will be initialized by runMcpServer via initializeBrowserAndDependencies
let playwrightController: PlaywrightController | null = null;
let domParser: DomParser | null = null;

// --- Core Server Function ---
async function initializeBrowserAndDependencies(
  options: Pick<
    McpServerOptions,
    "headlessBrowser" | "targetUrl" | "customAttributeReaders"
  >
): Promise<void> {
  console.log(
    `[mcp_server.ts] Initializing PlaywrightController (Headless: ${options.headlessBrowser})...`
  );
  playwrightController = new PlaywrightController(
    { headless: options.headlessBrowser },
    options.customAttributeReaders || []
  );

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

  domParser = new DomParser(pageInstance, options.customAttributeReaders || []);
  console.log("[mcp_server.ts] DomParser initialized.");
  console.log(
    "[mcp_server.ts] Browser and dependencies initialized successfully."
  );
}

// --- MCP Server Instance ---
// Server instance is now created within runMcpServer
let server: FastMCP<any> | null = null;

// --- Tool Definitions ---
// These functions will add tools to the server instance when it's created.
function addCoreTools(mcpServer: FastMCP<any>) {
  // Get Current Screen Data Tool
  mcpServer.addTool({
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

        const actions = interactiveElementsResult.data.flatMap(
          (el: InteractiveElementInfo) => {
            const generatedActions: any[] = [];

            // Default click action for many elements
            if (
              el.elementType === "button" ||
              el.elementType === "input-button" ||
              el.elementType === "input-submit" ||
              el.elementType === "a" ||
              !el.elementType?.startsWith("input-")
            ) {
              generatedActions.push({
                id: el.id,
                label: el.label,
                elementType: el.elementType,
                purpose: el.purpose,
                commandHint: `click #${el.id}`,
                currentValue: el.currentValue,
                isChecked: el.isChecked,
                isDisabled: el.isDisabled,
                isReadOnly: el.isReadOnly,
              });
            }

            // Type action for text inputs
            if (
              (el.elementType?.startsWith("input-") &&
                ![
                  "input-button",
                  "input-submit",
                  "input-checkbox",
                  "input-radio",
                  "input-file",
                  "input-reset",
                  "input-image",
                  "input-color",
                  "input-range",
                  "input-date",
                  "input-month",
                  "input-week",
                  "input-time",
                  "input-datetime-local",
                ].includes(el.elementType)) ||
              el.elementType === "textarea"
            ) {
              generatedActions.push({
                id: el.id,
                label: el.label,
                elementType: el.elementType,
                purpose: el.purpose,
                commandHint: `type #${el.id} "<text_to_type>"`,
                currentValue: el.currentValue,
                isChecked: el.isChecked,
                isDisabled: el.isDisabled,
                isReadOnly: el.isReadOnly,
              });
            }

            // Select action for select elements
            if (el.elementType === "select" && el.options) {
              generatedActions.push({
                id: el.id,
                label: el.label,
                elementType: el.elementType,
                purpose: el.purpose,
                commandHint: `select #${el.id} "<value_to_select>"`,
                currentValue: el.currentValue,
                options: el.options.map((opt) => ({
                  value: opt.value,
                  text: opt.text,
                })),
                isDisabled: el.isDisabled,
                isReadOnly: el.isReadOnly,
              });
            }

            // Check/uncheck for checkboxes
            if (el.elementType === "input-checkbox") {
              generatedActions.push({
                id: el.id,
                label: el.label,
                elementType: el.elementType,
                purpose: el.purpose,
                commandHint: el.isChecked
                  ? `uncheck #${el.id}`
                  : `check #${el.id}`,
                currentValue: el.currentValue,
                isChecked: el.isChecked,
                isDisabled: el.isDisabled,
                isReadOnly: el.isReadOnly,
              });
            }

            // Choose for radio buttons (note: command for radio usually involves selecting one from a group)
            if (el.elementType === "input-radio") {
              generatedActions.push({
                id: el.id, // Individual radio button ID
                label: el.label,
                radioGroup: el.radioGroup, // Group name is important here
                elementType: el.elementType,
                purpose: el.purpose,
                commandHint: `choose #${el.id}${
                  el.radioGroup ? " in_group " + el.radioGroup : ""
                }`,
                currentValue: el.currentValue, // Typically the value of the radio button itself
                isChecked: el.isChecked,
                isDisabled: el.isDisabled,
                isReadOnly: el.isReadOnly,
              });
            }

            return generatedActions;
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
}

function addSendCommandTool(mcpServer: FastMCP<any>) {
  mcpServer.addTool({
    name: "send_command",
    description:
      'Sends a command to interact with an element on the screen. Supported commands: click #elementId, type #elementId "text to type", select #elementId "valueToSelect", check #elementId, uncheck #elementId, choose #elementId [in_group groupName].',
    parameters: z.object({
      command_string: z.string(),
    }),
    execute: async (args) => {
      if (!playwrightController) {
        console.error(
          "[mcp_server.ts] send_command: PlaywrightController not initialized."
        );
        return JSON.stringify({
          success: false,
          message: "PlaywrightController not initialized.",
          errorType: PlaywrightErrorType.NotInitialized,
        });
      }

      const commandString = args.command_string.trim();
      console.log(`[mcp_server.ts] Received command: ${commandString}`);

      let result: ActionResult<any> = {
        success: false,
        message: "Invalid command string.",
        errorType: PlaywrightErrorType.InvalidInput,
      };

      // Improved regex to handle quoted strings more robustly
      const clickMatch = commandString.match(/^click #([^\s]+)$/i);
      const typeMatch = commandString.match(/^type #([^\s]+) "(.*)"$/i); // Allows spaces in typed text
      const selectMatch = commandString.match(/^select #([^\s]+) "(.*)"$/i);
      const checkMatch = commandString.match(/^check #([^\s]+)$/i);
      const uncheckMatch = commandString.match(/^uncheck #([^\s]+)$/i);
      // choose #elementId or choose #elementId in_group groupName
      const chooseMatch = commandString.match(
        /^choose #([^\s]+)(?:\s+in_group\s+([^\s]+))?$/i
      );

      if (clickMatch) {
        const elementId = clickMatch[1];
        console.log(`[mcp_server.ts] Executing click on #${elementId}`);
        result = await playwrightController.click(elementId);
      } else if (typeMatch) {
        const elementId = typeMatch[1];
        const textToType = typeMatch[2];
        console.log(
          `[mcp_server.ts] Executing type "${textToType}" into #${elementId}`
        );
        result = await playwrightController.type(elementId, textToType);
      } else if (selectMatch) {
        const elementId = selectMatch[1];
        const valueToSelect = selectMatch[2];
        console.log(
          `[mcp_server.ts] Executing select "${valueToSelect}" for #${elementId}`
        );
        result = await playwrightController.selectOption(
          elementId,
          valueToSelect
        );
      } else if (checkMatch) {
        const elementId = checkMatch[1];
        console.log(`[mcp_server.ts] Executing check on #${elementId}`);
        result = await playwrightController.checkElement(elementId);
      } else if (uncheckMatch) {
        const elementId = uncheckMatch[1];
        console.log(`[mcp_server.ts] Executing uncheck on #${elementId}`);
        result = await playwrightController.uncheckElement(elementId);
      } else if (chooseMatch) {
        const elementId = chooseMatch[1];
        const groupName = chooseMatch[2]; // This might be undefined if not provided
        console.log(
          `[mcp_server.ts] Executing choose on #${elementId}${
            groupName ? " in group " + groupName : ""
          }`
        );
        // We'll pass elementId as the primary identifier. PlaywrightController
        // might use groupName if available to ensure it's choosing the correct radio from a named group.
        // For now, the controller primarily uses the elementId of the specific radio.
        result = await playwrightController.selectRadioButton(
          elementId,
          elementId
        ); // valueToSelect can be the ID itself for radio
      } else {
        console.warn("[mcp_server.ts] Unrecognized command format.");
        // Result is already set to invalid command string
      }

      return JSON.stringify(result);
    },
  });
}

// --- Main Server Function (Exported) ---
/**
 * Initializes and starts the MCP server with the given options.
 */
export async function runMcpServer(options: McpServerOptions): Promise<void> {
  // Validate server version format if provided
  if (options.serverVersion && !/^\d+\.\d+\.\d+$/.test(options.serverVersion)) {
    console.warn(
      `[mcp_server.ts] Invalid serverVersion format: "${options.serverVersion}". It should be X.Y.Z. Using default.`
    );
    // Optionally, you could throw an error or clear it to use FastMCP's internal default if it has one,
    // or ensure your default below is used.
    options.serverVersion = undefined; // Or set to a valid default like "0.1.0"
  }

  // Ensure SSE endpoint starts with a slash if provided
  if (options.sseEndpoint && !options.sseEndpoint.startsWith("/")) {
    console.warn(
      `[mcp_server.ts] McpServerOptions.sseEndpoint "${options.sseEndpoint}" must start with a '/'. Prepending '/'.`
    );
    options.sseEndpoint = `/${options.sseEndpoint}` as `/${string}`;
  }

  console.log(
    `[mcp_server.ts] runMcpServer called with options: ${JSON.stringify({
      ...options,
      // Redact sensitive parts if any for logging, though current options are not sensitive
    })}`
  );

  // Initialize browser and dependencies first
  // Use provided options, falling back to defaults for headless and targetUrl if necessary
  await initializeBrowserAndDependencies({
    headlessBrowser:
      options.headlessBrowser === undefined ? true : options.headlessBrowser, // Default to true (headless)
    targetUrl: options.targetUrl, // targetUrl is mandatory in McpServerOptions
    customAttributeReaders: options.customAttributeReaders || [], // Pass through
  });

  const { authenticateClient } = options;

  server = new FastMCP({
    name: options.serverName || "react-cli-mcp-server",
    version: options.serverVersion || "0.1.0",
    instructions: options.serverInstructions,
    // Ping, health, roots can be configured here if defaults are not suitable
    // ping: { enabled: true, intervalMs: 10000, logLevel: 'debug' },
    // health: { enabled: true, path: '/healthz', message: 'healthy', status: 200 },
    // roots: { enabled: true },

    authenticate: authenticateClient
      ? async (request: any) => {
          // Ensure request.headers is an object, even if undefined initially
          const headers =
            typeof request.headers === "object" && request.headers !== null
              ? request.headers
              : {};

          // Attempt to get source IP, common properties vary by environment/Node version
          let sourceIp: string | undefined = undefined;
          if (request.socket) {
            // Standard Node HTTP server
            sourceIp = request.socket.remoteAddress;
          } else if (request.req?.socket) {
            // Sometimes nested in frameworks
            sourceIp = request.req.socket.remoteAddress;
          } else if (request.ip) {
            // Common in Express-like frameworks
            sourceIp = request.ip;
          }

          const clientContext: ClientAuthContext = {
            headers: headers as Record<string, string | string[] | undefined>,
            sourceIp: sourceIp,
          };

          try {
            const isAuthorized = await authenticateClient(clientContext);
            if (isAuthorized) {
              console.log(
                `[mcp_server.ts] Client authenticated successfully. IP: ${
                  sourceIp || "unknown"
                }`
              );
              return { authenticatedUser: true, details: { sourceIp } }; // Session data
            }
            console.warn(
              `[mcp_server.ts] Client authentication failed by custom callback. IP: ${
                sourceIp || "unknown"
              }`
            );
            throw new Response(null, {
              status: 401,
              statusText: "Unauthorized by custom authentication policy",
            });
          } catch (error: any) {
            console.error(
              `[mcp_server.ts] Error during 'authenticateClient' or auth failed. IP: ${
                sourceIp || "unknown"
              }. Error:`,
              error
            );
            if (error instanceof Response) {
              throw error; // Re-throw if it's already a Response object (e.g. thrown by the callback or above)
            }
            throw new Response(null, {
              status: 401, // Or 500 if the error is truly internal to the auth callback
              statusText:
                "Unauthorized due to authentication error or policy failure",
            });
          }
        }
      : undefined,
  });

  addCoreTools(server);
  addSendCommandTool(server);

  const port = options.port || 8090;
  const ssePath = options.sseEndpoint || "/sse"; // This is the intended path for clients to use

  console.log(
    `[mcp_server.ts] Starting FastMCP server on port ${port}. Configured client endpoint: ${ssePath}`
  );

  await server.start({
    transportType: "httpStream",
    httpStream: {
      port: port,
      endpoint: ssePath,
    },
  });

  console.log(
    `[mcp_server.ts] FastMCP server started successfully on port ${port}, HTTP stream endpoint ${ssePath}.`
  );
}

// --- Main Execution (for direct script run) ---
// This allows the server to be started directly via `node src/mcp_server.js`
// after compilation, useful for standalone operation or simple deployments.
async function main() {
  console.log("[mcp_server.ts] Main function called.");
  const targetUrl = process.env.MCP_TARGET_URL;
  if (!targetUrl) {
    console.error(
      "[mcp_server.ts] CRITICAL: MCP_TARGET_URL environment variable is not set."
    );
    process.exit(1);
  }

  const headless = process.env.MCP_HEADLESS_BROWSER !== "false"; // Default to true (headless)
  const port = parseInt(process.env.MCP_PORT || "8090", 10);
  let sseEndpoint = process.env.MCP_SSE_ENDPOINT || "/sse";
  if (!sseEndpoint.startsWith("/")) {
    console.warn(
      `[mcp_server.ts] MCP_SSE_ENDPOINT "${sseEndpoint}" must start with a '/'. Prepending '/'.`
    );
    sseEndpoint = `/${sseEndpoint}`;
  }

  const serverName =
    process.env.MCP_SERVER_NAME || "react-cli-mcp-server (direct run)";
  const serverVersionStr = process.env.MCP_SERVER_VERSION || "0.1.0";
  let serverVersion: `${number}.${number}.${number}` | undefined = undefined;
  if (/^\d+\.\d+\.\d+$/.test(serverVersionStr)) {
    serverVersion = serverVersionStr as `${number}.${number}.${number}`;
  } else {
    console.warn(
      `[mcp_server.ts] Invalid MCP_SERVER_VERSION format: "${serverVersionStr}". Using default.`
    );
  }

  const serverInstructions =
    process.env.MCP_SERVER_INSTRUCTIONS ||
    "Default instructions for react-cli-mcp.";

  const options: McpServerOptions = {
    targetUrl,
    headlessBrowser: headless,
    port: port,
    sseEndpoint: sseEndpoint as `/${string}`,
    serverName: serverName,
    serverVersion: serverVersion,
    serverInstructions: serverInstructions,
    // authenticateClient can be added here if configured via environment variables,
    // though it's more complex for a direct run without code changes.
  };

  try {
    console.log("[mcp_server.ts] Attempting to run MCP server from main()...");
    await runMcpServer(options);
  } catch (error) {
    console.error("[mcp_server.ts] Failed to run MCP server from main:", error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(
    `[mcp_server.ts] Received ${signal}. Shutting down gracefully...`
  );
  if (server && typeof (server as any).close === "function") {
    try {
      console.log("[mcp_server.ts] Closing FastMCP server...");
      await (server as any).close();
      console.log("[mcp_server.ts] FastMCP server closed.");
    } catch (e) {
      console.error("[mcp_server.ts] Error closing FastMCP server:", e);
    }
  } else if (server) {
    console.warn(
      "[mcp_server.ts] server.close() method not found or not a function. FastMCP server might not have a dedicated close method or it's not being correctly typed."
    );
  }

  if (playwrightController) {
    try {
      console.log("[mcp_server.ts] Closing Playwright browser...");
      await playwrightController.close();
      console.log("[mcp_server.ts] Playwright browser closed.");
    } catch (e) {
      console.error("[mcp_server.ts] Error closing Playwright browser:", e);
    }
  }
  console.log("[mcp_server.ts] Shutdown complete.");
  process.exit(0);
}

// Listen for shutdown signals
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Check if the script is being run directly
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log("[mcp_server.ts] Script is being run directly. Calling main().");
  main().catch((err) => {
    // Catch any unhandled errors from main() itself, though it has its own try/catch
    console.error(
      "[mcp_server.ts] Unhandled error from direct main() execution:",
      err
    );
    process.exit(1);
  });
}
