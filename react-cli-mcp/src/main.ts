import { initializeAndStartServer } from "./mcp_server.js";

async function main() {
  console.log("Starting react-cli-mcp tool with MCP server...");

  try {
    await initializeAndStartServer();
    console.log("MCP Server initialization and start process completed.");
    // The initializeAndStartServer function now handles its own lifecycle,
    // including listening and graceful shutdown. So, main.ts mostly just kicks it off.
  } catch (error) {
    console.error("Failed to initialize and start the MCP server:", error);
    process.exit(1);
  }

  // Graceful shutdown logic previously here is now handled within initializeAndStartServer
  // in mcp_server.ts (e.g., process.on('SIGINT', ...)).
  // main.ts can now be simpler as it delegates the server lifecycle.
}

main().catch((error) => {
  console.error("Unhandled error in main function:", error);
  process.exit(1);
});
