import { runMcpServer } from "./mcp_server.js";
import { McpServerOptions } from "./types/index.js";

console.log("[main.ts] MCP server module loading initiated.");

async function startServer() {
  // Configuration resolution: Env Vars > Defaults
  const targetUrl = process.env.MCP_TARGET_URL || "http://localhost:5173";
  const headlessBrowser =
    (process.env.MCP_HEADLESS_BROWSER || "false").toLowerCase() === "true";
  const port = parseInt(process.env.MCP_PORT || "8090", 10);

  let sseEndpoint = process.env.MCP_SSE_ENDPOINT || "/sse";
  if (!sseEndpoint.startsWith("/")) {
    sseEndpoint = "/" + sseEndpoint;
  }
  const finalSseEndpoint = sseEndpoint as `/${string}`;

  let serverVersionFromEnv = process.env.MCP_SERVER_VERSION;
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (serverVersionFromEnv && !versionRegex.test(serverVersionFromEnv)) {
    console.warn(
      `[main.ts] Invalid MCP_SERVER_VERSION format: "${serverVersionFromEnv}". Using default "0.1.0".`
    );
    serverVersionFromEnv = undefined;
  }

  const options: McpServerOptions = {
    targetUrl,
    headlessBrowser,
    port: port,
    sseEndpoint: finalSseEndpoint,
    serverName: process.env.MCP_SERVER_NAME || "ReactCliMcpViaMain",
    serverVersion:
      (serverVersionFromEnv as `${number}.${number}.${number}`) || "0.1.0",
    serverInstructions: process.env.MCP_SERVER_INSTRUCTIONS,
  };

  try {
    console.log(
      "[main.ts] Attempting to start MCP server with options:",
      JSON.stringify(options, null, 2)
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
