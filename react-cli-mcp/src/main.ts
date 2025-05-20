import { runMcpServer, McpServerOptions } from "./mcp_server.js";

console.log("[main.ts] MCP server module loading initiated.");

async function startServer() {
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
      `[main.ts] Invalid MCP_SERVER_VERSION format: "${serverVersionFromEnv}". Using default "1.0.3".`
    );
    serverVersionFromEnv = undefined; // Use default if format is wrong
  }

  const options: McpServerOptions = {
    targetUrl,
    headlessBrowser,
    mcpPort,
    mcpSseEndpoint: finalSseEndpoint,
    serverName: process.env.MCP_SERVER_NAME || "ReactCliConversorViaMain", // Slightly different name to distinguish
    serverVersion:
      (serverVersionFromEnv as `${number}.${number}.${number}`) || "1.0.3",
    serverInstructions: process.env.MCP_SERVER_INSTRUCTIONS,
  };

  try {
    console.log(
      "[main.ts] Attempting to start MCP server with options:",
      options
    );
    await runMcpServer(options);
    console.log("[main.ts] MCP Server is running.");
  } catch (error) {
    console.error("[main.ts] Failed to start MCP server:", error);
    process.exit(1);
  }
}

startServer();

// The process will stay alive because the MCP server started by runMcpServer
// is running (assuming it starts an HTTP/SSE server that keeps Node alive).
