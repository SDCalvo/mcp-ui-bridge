import React, { useState } from "react";

const AttributeTest: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [toggleClicked, setToggleClicked] = useState(0);

  const handleToggle = () => {
    setIsActive(!isActive);
    setToggleClicked((prev) => prev + 1);
  };

  return (
    <div className="mt-8 p-6 border rounded-lg shadow-md bg-gray-50">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">
        MCP Attribute Test Area
      </h2>

      <div className="space-y-4">
        {/* Test 1: Explicit Element Type */}
        <div
          data-mcp-interactive-element="explicit-type-button"
          data-mcp-element-type="custom-div-button" // Explicitly setting type
          data-mcp-purpose="Acts as a button via div"
          className="p-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 text-center"
          onClick={() => alert("Explicit type button clicked!")}
          role="button" // For accessibility
          tabIndex={0} // For accessibility
          onKeyDown={(e) =>
            e.key === "Enter" && alert("Explicit type button clicked!")
          }
        >
          Click Me (I'm a Div Button)
        </div>

        {/* Test 2: Dynamic Element State */}
        <div className="flex items-center space-x-3">
          <div
            data-mcp-interactive-element="stateful-toggle"
            data-mcp-element-state={isActive ? "active" : "inactive"} // Dynamic state
            data-mcp-purpose="Toggles a custom active/inactive state"
            onClick={handleToggle}
            className={`p-2 rounded cursor-pointer text-white transition-colors text-center ${
              isActive
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            }`}
            role="switch" // For accessibility
            aria-checked={isActive} // For accessibility
            tabIndex={0} // For accessibility
            onKeyDown={(e) => e.key === "Enter" && handleToggle()}
          >
            {isActive ? "State: ACTIVE" : "State: INACTIVE"} (Click to toggle)
          </div>
          <span className="text-sm text-gray-600">
            (Clicked {toggleClicked} times)
          </span>
        </div>

        {/* Test 3: Explicit Value on a non-input */}
        <div className="flex items-center space-x-3">
          <span
            data-mcp-interactive-element="explicit-value-span"
            data-mcp-element-type="display-text-with-value" // Custom type for clarity
            data-mcp-value="HelloMCP_ExplicitValue123" // Explicit value
            data-mcp-purpose="Displays text with an explicit MCP value"
            className="p-2 bg-purple-100 text-purple-700 rounded border border-purple-300"
          >
            I'm a span with an explicit MCP value.
          </span>
          <button
            data-mcp-interactive-element="reveal-span-value-button"
            data-mcp-purpose="Alerts the value of the explicit-value-span"
            onClick={() =>
              alert(
                "Value of span (from JS perspective) is not directly readable here, but MCP tool should see data-mcp-value."
              )
            }
            className="p-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Test MCP Value Read
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttributeTest;
