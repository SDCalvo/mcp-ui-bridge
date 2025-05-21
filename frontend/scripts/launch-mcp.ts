import { runMcpServer, type McpServerOptions } from "react-cli-mcp";

async function main() {
  const options: McpServerOptions = {
    targetUrl: "http://localhost:5173", // Make sure this is where your frontend dev server runs
    headlessBrowser: false,
    mcpPort: 3001, // Port for the MCP server itself
    mcpSseEndpoint: "/mcp/sse",
    serverName: "Frontend_Test_Agent",
    serverVersion: "0.1.0", // Can be any valid version for this test instance
    serverInstructions:
      "This agent is for testing the react-cli-mcp library with the local frontend application.",
  };

  try {
    console.log(
      `Attempting to start react-cli-mcp server via linked package...`
    );
    console.log(`Targeting: ${options.targetUrl}`);
    console.log(
      `MCP Server will run on: http://localhost:${options.mcpPort}${options.mcpSseEndpoint}`
    );

    await runMcpServer(options);

    console.log(
      `react-cli-mcp server started successfully through the linked package.`
    );
    // The runMcpServer function has its own logging for when it's up and running.
  } catch (error) {
    console.error(
      "Failed to start react-cli-mcp server via linked package:",
      error
    );
    process.exit(1);
  }
}

main();
