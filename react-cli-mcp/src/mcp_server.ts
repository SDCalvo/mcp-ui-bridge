// Re-confirming mcp_server.ts content. The tsconfig.json is correct.
// The primary suspect for 'Cannot find module ./core/types' is IDE/linter caching or state.
console.log("[MCP Server] File loading... (v3 - With Output Schemas)");

import express, { Request, Response } from "express";
import http from "http";
// Use correct subpath imports based on SDK structure and package.json exports
// Attempting to include .js extension directly for type resolution with nodenext
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

import { PlaywrightController } from "./core/playwright-controller.js";
import { DomParser } from "./core/dom-parser.js";
import {
  ActionResult,
  ParserResult,
  PlaywrightErrorType,
  DomParserErrorType,
} from "./core/types.js";
import {
  InteractiveElementInfo,
  DisplayItem,
  DisplayContainerInfo,
  PageRegionInfo,
  StatusMessageAreaInfo,
  LoadingIndicatorInfo,
} from "./types/index.js";

// --- Zod Schema for send_command INPUT ---
const SendCommandInputSchema = z.object({
  command_string: z
    .string()
    .describe(
      "The command string to execute. Format examples: 'click #elementId', 'type #elementId your text here'"
    ),
});

// Define a local interface compatible with the SDK's expected tool result structure
interface McpToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, any>; // Make optional if not always present
  isError?: boolean;
  [key: string]: any;
}

const app = express();
const PORT = process.env.MCP_PORT || 3000;
const TARGET_APP_URL = process.env.TARGET_APP_URL || "http://localhost:5173";

let playwrightController: PlaywrightController | null = null;
let domParser: DomParser | null = null;
let currentSseTransport: SSEServerTransport | null = null;

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
      tools: {},
      prompts: {},
      resources: {},
      logging: {},
    },
  }
);

// --- Define Tools using SDK ---
// The SDK's server.tool() signature for providing input and output schemas is typically:
// server.tool(name, { paramSchema?: ZodSchema, outputSchema?: ZodSchema, description?: string }, handler)

mcpServer.tool(
  "get_current_screen_actions",
  {
    // paramSchema: z.object({}), // No input params
    description:
      "Get all interactive elements from the current screen. Output is a string, potentially JSON, detailing elements and their state. The exact format of the string will be LLM-readable.",
  },
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
    const result: ParserResult<InteractiveElementInfo[]> = // Ensure DomParser returns this type
      await domParser.getInteractiveElementsWithState();

    if (result.success && result.data) {
      return {
        content: [
          {
            type: "text",
            text: `Found ${
              result.data.length
            } interactive elements. (Raw data: ${JSON.stringify(
              result.data,
              null,
              2
            )})`,
          },
        ],
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
  {
    // paramSchema: z.object({}), // No input params
    description:
      "Get structured data content from the current screen. Output is a string, potentially JSON, detailing elements and their state. The exact format of the string will be LLM-readable.",
  },
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
    // Assuming domParser.getStructuredData() returns a structure compatible with StructuredDataSchema
    const result = await domParser.getStructuredData();
    if (result.success && result.data) {
      return {
        content: [
          {
            type: "text",
            text: `Successfully retrieved screen data. (Raw data: ${JSON.stringify(
              result.data,
              null,
              2
            )})`,
          },
        ],
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

mcpServer.tool(
  "send_command",
  {
    paramSchema: SendCommandInputSchema.shape,
    description: `Sends a command to an element on the page. Input is a single command string. Examples: 
- 'click #submitButton'
- 'type #usernameField UserMcUserFace'
- 'type #passwordField s3cr3tPa$$'
Ensure selectors are valid CSS selectors, typically targeting 'data-mcp-interactive-element' values (e.g., '#elementId').`,
  },
  async (
    args: { [key: string]: any }, // Reverted to generic args for SDK compatibility
    callContext?: any
  ): Promise<McpToolResult> => {
    // Explicitly parse command_string from generic args
    const validatedParams = SendCommandInputSchema.parse(args);
    const commandString = validatedParams.command_string;

    console.log(
      "[MCP Tool Call] send_command, String:",
      commandString,
      "Context:",
      callContext
    );

    if (!playwrightController) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Playwright Controller not initialized.",
          },
        ],
        isError: true,
      };
    }

    // Basic parsing for command_string: "action target [value...]"
    // This is a placeholder and should be made more robust.
    const parts = commandString.trim().split(/\s+/);
    const actionToPerform = parts[0]?.toLowerCase();
    const commandId = parts[1]; // This is the selector
    const textToType = parts.slice(2).join(" ");

    let actionResult: ActionResult<any>;

    if (!actionToPerform || !commandId) {
      actionResult = {
        success: false,
        message:
          "Error: Invalid command string format. Expected 'action target [value...]'. Example: 'click #myButton' or 'type #myInput text'.",
        errorType: PlaywrightErrorType.InvalidInput, // Assuming you add this to your enum
      };
    } else {
      switch (actionToPerform) {
        case "click":
          actionResult = await playwrightController.click(commandId);
          break;
        case "type":
          if (textToType) {
            actionResult = await playwrightController.type(
              commandId,
              textToType
            );
          } else {
            actionResult = {
              success: false,
              message:
                "Error: Missing 'text' argument for 'type' action. Expected 'type target text'.",
              errorType: PlaywrightErrorType.InvalidInput,
            };
          }
          break;
        default:
          actionResult = {
            success: false,
            message: `Error: Unknown action '${actionToPerform}'. Supported actions: 'click', 'type'.`,
            errorType: PlaywrightErrorType.InvalidInput,
          };
      }
    }

    return {
      content: [
        {
          type: "text",
          text:
            actionResult.message ||
            (actionResult.success ? "Command executed." : "Command failed."),
        },
      ],
      isError: !actionResult.success,
    };
  }
);

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
  currentSseTransport = transport;
  mcpServer.connect(transport);
  req.on("close", () => {
    console.log(`[Express] GET ${ssePath} - SSE Client disconnected.`);
    if (currentSseTransport === transport) {
      currentSseTransport = null;
    }
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
      await currentSseTransport.handlePostMessage(req, res, req.body);
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

export async function initializeAndStartServer() {
  console.log("[Main] Initializing PlaywrightController and DomParser...");
  try {
    playwrightController = new PlaywrightController({ headless: false }); // Changed to false for visibility
    const launchResult = await playwrightController.launch();
    if (!launchResult.success) {
      console.error(
        "[Main] Fatal error during Playwright launch:",
        launchResult.message
      );
      process.exit(1);
    }
    console.log("[Main] Playwright launched successfully.");
    console.log(`[Main] Navigating to target application: ${TARGET_APP_URL}`);
    const navigateResult = await playwrightController.navigate(TARGET_APP_URL, {
      waitUntil: "networkidle",
    });
    if (!navigateResult.success) {
      console.error(
        `[Main] Fatal error navigating to ${TARGET_APP_URL}:`,
        navigateResult.message
      );
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
      domParser = new DomParser(null as any); // Allow DomParser to handle null page gracefully
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

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, () => {
    console.log(`[Main] HTTP Server listening on port ${PORT}.`);
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
