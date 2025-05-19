// Re-confirming mcp_server.ts content. The tsconfig.json is correct.
// The primary suspect for 'Cannot find module ./core/types' is IDE/linter caching or state.
console.log("[MCP Server] File loading... (v2)");

import express, { Request, Response } from "express";
import http from "http";
// Use correct subpath imports based on SDK structure and package.json exports
// Attempting to include .js extension directly for type resolution with nodenext
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

import { PlaywrightController } from "./core/playwright-controller.js";
import { DomParser } from "./core/dom-parser.js";
import { ActionResult, ParserResult } from "./core/types.js";

// Define a local interface compatible with the SDK's expected tool result structure
// Based on linter errors, content array should primarily contain specific known types like 'text'.
interface McpToolResult {
  content: { type: "text"; text: string }[]; // More specific to satisfy SDK
  // We could add other specific SDK types like image, audio, resource if needed:
  // | { type: "image"; data: string; mimeType: string }
  // | { type: "audio"; data: string; mimeType: string }
  // | { type: "resource"; resource: { uri: string; text?: string; mimeType?: string; blob?: string } }
  structuredContent: Record<string, any>;
  isError?: boolean; // Ensure this is here
  [key: string]: any; // Add index signature to match SDK's CallToolResult flexibility
}

const app = express();
const PORT = process.env.MCP_PORT || 3000;
const TARGET_APP_URL = process.env.TARGET_APP_URL || "http://localhost:5173"; // Added for MCP server

// --- Globals for Playwright and Parser ---
let playwrightController: PlaywrightController | null = null;
let domParser: DomParser | null = null;
let currentSseTransport: SSEServerTransport | null = null; // Store the active transport

// --- Initialize MCP Server with SDK ---
console.log("[MCP Server] Initializing MCP Server with SDK...");
const mcpServer = new McpServer(
  {
    name: "react-app-mcp-agent",
    version: "1.0.0",
    description:
      "MCP server for interacting with a target React application via Playwright.",
  },
  {
    capabilities: {
      tools: {}, // Tools are registered using server.tool() below
      prompts: {},
      resources: {},
      logging: {}, // Assuming an empty object satisfies the type if true/false is not direct.
    },
  }
);

// --- Define Tools using SDK ---

mcpServer.tool(
  "get_current_screen_actions",
  "Get all interactive elements and their state from the current screen.",
  async (callContext: any): Promise<McpToolResult> => {
    console.log(
      "[MCP Tool Call] get_current_screen_actions, Context:",
      callContext
    );
    if (!domParser) {
      return {
        content: [{ type: "text", text: "Error: DOM Parser not initialized." }],
        structuredContent: { error: "DOM Parser not initialized" },
        isError: true,
      };
    }
    const result: ParserResult<any[]> =
      await domParser.getInteractiveElementsWithState();
    if (result.success && result.data) {
      return {
        content: [
          {
            type: "text",
            text: `Found ${result.data.length} interactive elements.`,
          },
        ],
        structuredContent: { data: result.data },
        isError: false,
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: result.message || "Failed to get screen actions.",
          },
        ],
        structuredContent: {
          error: result.message || "Failed to get screen actions.",
        },
        isError: true,
      };
    }
  }
);

mcpServer.tool(
  "get_current_screen_data",
  "Get structured data content from the current screen.",
  async (callContext: any): Promise<McpToolResult> => {
    console.log(
      "[MCP Tool Call] get_current_screen_data, Context:",
      callContext
    );
    if (!domParser) {
      return {
        content: [{ type: "text", text: "Error: DOM Parser not initialized." }],
        structuredContent: { error: "DOM Parser not initialized" },
        isError: true,
      };
    }
    const result = await domParser.getStructuredData();
    if (result.success && result.data) {
      return {
        content: [
          { type: "text", text: "Successfully retrieved screen data." },
        ],
        structuredContent: { data: result.data },
        isError: false,
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: result.message || "Failed to get screen data.",
          },
        ],
        structuredContent: {
          error: result.message || "Failed to get screen data.",
        },
        isError: true,
      };
    }
  }
);

// Define the shape for send_command parameters
const SendCommandZodSchema = z.object({
  command_id: z
    .string()
    .describe(
      "The unique ID of the command to execute (typically a selector)."
    ),
  action: z
    .enum(["click", "type"])
    .optional()
    .describe(
      "The action to perform (e.g., 'click', 'type'). Defaults to 'click' if not provided."
    ),
  text: z.string().optional().describe("Text to type if action is 'type'."),
});

mcpServer.tool(
  "send_command",
  SendCommandZodSchema.shape, // Pass the raw shape
  async (
    params: z.infer<typeof SendCommandZodSchema>
  ): Promise<McpToolResult> => {
    console.log("[MCP Tool Call] send_command, Params:", params);
    if (!playwrightController) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Playwright Controller not initialized.",
          },
        ],
        structuredContent: { error: "Playwright Controller not initialized" },
        isError: true,
      };
    }

    let actionResult: ActionResult;
    const commandId = params.command_id;
    const actionToPerform = params.action || "click";
    const textToType = params.text;

    switch (actionToPerform) {
      case "click":
        actionResult = await playwrightController.click(commandId);
        break;
      case "type":
        if (typeof textToType === "string") {
          actionResult = await playwrightController.type(commandId, textToType);
        } else {
          actionResult = {
            success: false,
            message:
              "Error: Missing 'text' argument for 'type' action in send_command.",
          };
        }
        break;
      default:
        actionResult = {
          success: false,
          message: `Invalid action: ${actionToPerform}`,
        };
    }

    if (actionResult.success) {
      return {
        content: [
          {
            type: "text",
            text: actionResult.message || "Command executed successfully.",
          },
        ],
        structuredContent: { success: true, message: actionResult.message },
        isError: false,
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: actionResult.message || "Failed to execute command.",
          },
        ],
        structuredContent: {
          success: false,
          error: actionResult.message,
          errorType: actionResult.errorType,
        },
        isError: true,
      };
    }
  }
);

// --- Set up Express with MCP SSE Transport ---
app.use(express.json());

const ssePath = "/mcp/sse";
const messagesPath = "/mcp/rpc";

console.log(`[MCP Server] SSE endpoint will be at GET ${ssePath}`);
console.log(
  `[MCP Server] RPC message endpoint will be at POST ${messagesPath}`
);

app.get(ssePath, (req: Request, res: Response) => {
  console.log(`[Express] GET ${ssePath} - Client connecting for SSE.`);
  const transport = new SSEServerTransport(messagesPath, res);
  currentSseTransport = transport; // Store the transport
  mcpServer.connect(transport);

  // Clean up transport on client disconnect
  req.on("close", () => {
    console.log(`[Express] GET ${ssePath} - SSE Client disconnected.`);
    if (currentSseTransport === transport) {
      currentSseTransport = null;
    }
    // The SDK or McpServer might have its own disconnect logic for the transport
    // mcpServer.disconnect(transport); // If such a method exists
  });
});

app.post(messagesPath, async (req: Request, res: Response) => {
  console.log(
    `[Express] POST ${messagesPath} - Received RPC message: ${JSON.stringify(
      req.body
    )}`
  );

  if (currentSseTransport) {
    try {
      console.log(
        "[Express] Forwarding RPC message to McpServer via SSEServerTransport.handlePostMessage."
      );
      // Let the transport handle the POST message. It will process it and send the response via SSE.
      // It also handles sending back an HTTP acknowledgement for the POST if necessary.
      await currentSseTransport.handlePostMessage(req, res, req.body);
      // If handlePostMessage doesn't send an HTTP response, we might need to do it here.
      // However, the example implies it handles the full interaction.
      // Safely check if headers were already sent by handlePostMessage.
      if (!res.headersSent) {
        console.warn(
          "[Express] POST /mcp/rpc - handlePostMessage did not send HTTP response. Sending 202."
        );
        res
          .status(202)
          .json({ message: "RPC acknowledged, response via SSE." });
      }
    } catch (error) {
      console.error(
        "[Express] Error calling currentSseTransport.handlePostMessage:",
        error
      );
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Error processing RPC message via transport" });
      }
    }
  } else {
    console.error(
      "[Express] No active SSE transport available to handle POST message."
    );
    if (!res.headersSent) {
      res
        .status(400)
        .json({ error: "No active SSE transport for this request" });
    }
  }
});

console.log(
  "[MCP Server] SDK server and tools defined. Express routing configured."
);

async function initializeAndStartServer() {
  console.log("[Main] Initializing PlaywrightController and DomParser...");
  try {
    playwrightController = new PlaywrightController({ headless: false });
    const launchResult = await playwrightController.launch();
    if (!launchResult.success) {
      console.error(
        "[Main] Fatal error during Playwright launch:",
        launchResult.message
      );
      process.exit(1);
    }
    console.log("[Main] Playwright launched successfully.");

    // Navigate to the target application URL
    console.log(`[Main] Navigating to target application: ${TARGET_APP_URL}`);
    const navigateResult = await playwrightController.navigate(TARGET_APP_URL, {
      waitUntil: "networkidle", // Or your preferred wait condition
    });

    if (!navigateResult.success) {
      console.error(
        `[Main] Fatal error navigating to ${TARGET_APP_URL}:`,
        navigateResult.message
      );
      // Decide if you want to exit or continue with a potentially blank/error page
      // For now, we'll try to get the page anyway, but DomParser might not be useful.
    } else {
      console.log(`[Main] Successfully navigated to ${TARGET_APP_URL}.`);
    }

    const page = await playwrightController.getPage();
    if (page) {
      domParser = new DomParser(page);
    } else {
      console.warn(
        "[Main] Playwright page was not available after launch for DomParser."
      );
      // Depending on strictness, you might throw an error or allow proceeding without domParser
      domParser = new DomParser(null); // Allow DomParser to handle null page gracefully
    }
    console.log(
      "[Main] PlaywrightController and DomParser initialized (or attempted)."
    );
  } catch (error) {
    console.error(
      "[Main] Fatal error during Playwright/DOM Parser initialization:",
      error
    );
    process.exit(1);
  }

  // Express app and HTTP server startup will be added here in the next step.
  const httpServer = http.createServer(app); // app is currently empty, will be configured next
  httpServer.listen(PORT, () => {
    console.log(
      `[Main] HTTP Server listening on port ${PORT}. MCP routes to be configured.`
    );
    console.log(`[Main] MCP Server using SDK is configured.`);
    console.log(`[Main] SSE Endpoint: http://localhost:${PORT}${ssePath}`);
    console.log(
      `[Main] RPC Messages POST Endpoint: http://localhost:${PORT}${messagesPath}`
    );
  });

  process.on("SIGINT", async () => {
    console.log("\n[Main] Shutting down MCP server...");
    if (playwrightController) {
      await playwrightController.close();
    }
    httpServer.close(() => {
      console.log("[Main] Server closed.");
      process.exit(0);
    });
  });
}

// app.use(express.json()); // Will be moved into the next step with route definitions

// End of Part 1. Routes and full server start in Part 2.

initializeAndStartServer().catch((error) => {
  console.error("[Main] Failed to initialize or start server:", error);
  process.exit(1);
});
