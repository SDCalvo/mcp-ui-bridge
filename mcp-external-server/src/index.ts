import {
  runMcpServer,
  McpServerOptions,
  ClientAuthContext,
  CustomAttributeReader,
} from "mcp-ui-bridge";

async function main() {
  console.log("Starting MCP External Server...");

  // TODO: Set this to true or false to simulate auth success/failure
  const MANUALLY_ALLOW_CONNECTION = true;

  // Define a sample custom attribute reader
  const sampleCustomReaders: CustomAttributeReader[] = [
    {
      attributeName: "data-mcp-custom-note",
      outputKey: "customNote",
      // No processValue, so it will store the raw string value
    },
    {
      attributeName: "data-mcp-item-priority",
      outputKey: "itemPriority",
      processValue: (value: string | null) => {
        if (value === null) return undefined; // Attribute not present
        const numericValue = parseInt(value, 10);
        return isNaN(numericValue) ? value : numericValue; // Return number if valid, else original string
      },
    },
  ];

  const options: McpServerOptions = {
    targetUrl: process.env.MCP_TARGET_URL || "http://localhost:5173", // Your frontend URL
    port: Number(process.env.MCP_PORT) || 8070, // Different port from react-cli-mcp default if run simultaneously
    headlessBrowser: process.env.MCP_HEADLESS_BROWSER
      ? process.env.MCP_HEADLESS_BROWSER === "true"
      : false, // Default to headed for easier debugging initially
    serverName: "MCP External Server Example",
    serverVersion: "1.0.0",
    serverInstructions:
      "This is an MCP server running externally, powered by react-cli-mcp.",
    customAttributeReaders: sampleCustomReaders,
    // Example of how a user might provide a custom authentication function:
    authenticateClient: async (context: ClientAuthContext) => {
      console.log("[External Server] Auth attempt. Headers:", context.headers);
      console.log(
        "[External Server] Auth attempt. Source IP:",
        context.sourceIp
      );

      if (MANUALLY_ALLOW_CONNECTION) {
        console.log(
          "[External Server] Auth success! (MANUALLY_ALLOW_CONNECTION is true)"
        );
        return true;
      } else {
        console.log(
          "[External Server] Auth failed. (MANUALLY_ALLOW_CONNECTION is false)"
        );
        return false;
      }
    },
  };

  try {
    await runMcpServer(options);
    console.log(
      `MCP External Server successfully started and listening on port ${options.port}. Targeting ${options.targetUrl}`
    );
  } catch (error) {
    console.error("Failed to start MCP External Server:", error);
    process.exit(1);
  }
}

main();
