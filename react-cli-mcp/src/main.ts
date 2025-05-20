import "./mcp_server.js"; // This will execute mcp_server.js and start the server

console.log("[main.ts] MCP server module loading initiated.");

// The MCP server (mcp_server.js) now handles its own initialization and startup
// when imported. No further action is needed in main.ts to start it.

// If there were other application-specific initializations that don't involve
// the MCP server directly, they could go here.
// For now, we'll keep it simple.

// The process will stay alive because the MCP server started by mcp_server.js
// is running.
