import {
  runMcpServer,
  McpServerOptions,
  ClientAuthContext,
  CustomAttributeReader,
  CustomActionHandler,
  CustomActionHandlerParams,
  ActionResult,
  InteractiveElementInfo,
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

  // --- Define Custom Action Handlers ---
  const customHandlers: CustomActionHandler[] = [
    {
      commandName: "get-custom-note",
      handler: async (
        params: CustomActionHandlerParams
      ): Promise<ActionResult> => {
        console.log(
          `[Custom Handler] Executing get-custom-note for element: ${params.element.id}`
        );
        const note = params.element.customData?.customNote;
        if (note !== undefined) {
          return {
            success: true,
            message: `Custom note for ${params.element.id}: ${note}`,
            data: { customNote: note },
          };
        }
        return {
          success: false,
          message: `No customNote found for element ${params.element.id}`,
        };
      },
    },
    {
      commandName: "check-priority",
      handler: async (
        params: CustomActionHandlerParams
      ): Promise<ActionResult> => {
        console.log(
          `[Custom Handler] Executing check-priority for element: ${params.element.id} with args: ${params.commandArgs}`
        );
        const expectedPriority = params.commandArgs[0];
        if (expectedPriority === undefined) {
          return {
            success: false,
            message: "Expected priority argument is missing.",
          };
        }

        const actualPriority = params.element.customData?.itemPriority;

        if (actualPriority === undefined) {
          return {
            success: false,
            message: `No itemPriority found for element ${params.element.id}`,
          };
        }

        // Convert expectedPriority to number if actualPriority is a number for correct comparison
        const numericExpectedPriority = parseInt(expectedPriority, 10);
        const priorityToCompare =
          typeof actualPriority === "number" && !isNaN(numericExpectedPriority)
            ? numericExpectedPriority
            : expectedPriority;

        if (actualPriority == priorityToCompare) {
          // Use loose equality to handle string vs number if necessary
          return {
            success: true,
            message: `Priority matches for ${params.element.id}. Expected: ${expectedPriority}, Actual: ${actualPriority}`,
            data: { match: true, actualPriority },
          };
        }
        return {
          success: false,
          message: `Priority mismatch for ${params.element.id}. Expected: ${expectedPriority}, Actual: ${actualPriority}`,
          data: { match: false, actualPriority },
        };
      },
    },
    // Example of overriding a core command (optional, for testing)
    // {
    //   commandName: "click",
    //   overrideCoreBehavior: true,
    //   handler: async (params: CustomActionHandlerParams): Promise<ActionResult> => {
    //     console.log(`[Custom Override Handler] Intercepted CLICK on element: ${params.element.id}`);
    //     // You can add custom logic before or after calling the original action
    //     const result = await params.automation.click(params.element.id);
    //     console.log(`[Custom Override Handler] Original click action result:`, result);
    //     // You can modify the result if needed
    //     if (result.success) {
    //       result.message = "Clicked via custom override! " + result.message;
    //     }
    //     return result;
    //   }
    // }
  ];

  const options: McpServerOptions = {
    targetUrl: process.env.MCP_TARGET_URL || "http://localhost:5173", // Your frontend URL
    port: Number(process.env.MCP_PORT) || 8070, // Different port from react-cli-mcp default if run simultaneously
    headlessBrowser: process.env.MCP_HEADLESS_BROWSER
      ? process.env.MCP_HEADLESS_BROWSER === "true"
      : false, // Default to headed for easier debugging initially
    serverName: "MCP External Server Example with Custom Handlers",
    serverVersion: "1.0.1",
    serverInstructions:
      "This server includes custom commands: get-custom-note #id, check-priority #id <priority>",
    customAttributeReaders: sampleCustomReaders,
    customActionHandlers: customHandlers,
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
