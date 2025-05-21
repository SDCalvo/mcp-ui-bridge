import React, { useState } from "react";

const AttributeTest: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [toggleClicked, setToggleClicked] = useState(0);

  const handleToggle = () => {
    setIsActive(!isActive);
    setToggleClicked((prev) => prev + 1);
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h2 className="h5 card-title mb-3">MCP Attribute Test Area</h2>

        <div className="mb-3">
          {/* Test 1: Explicit Element Type */}
          <div
            data-mcp-interactive-element="explicit-type-button"
            data-mcp-element-type="custom-div-button" // Explicitly setting type
            data-mcp-purpose="Acts as a button via div"
            className="btn btn-info w-100 mb-2"
            onClick={() => alert("Explicit type button clicked!")}
            role="button" // For accessibility
            tabIndex={0} // For accessibility
            onKeyDown={(e) =>
              e.key === "Enter" && alert("Explicit type button clicked!")
            }
          >
            Click Me (I'm a Div Button)
          </div>
        </div>

        {/* Test 2: Dynamic Element State */}
        <div className="mb-3 d-flex align-items-center">
          <div
            data-mcp-interactive-element="stateful-toggle"
            data-mcp-element-state={isActive ? "active" : "inactive"} // Dynamic state
            data-mcp-purpose="Toggles a custom active/inactive state"
            onClick={handleToggle}
            className={`btn w-100 ${isActive ? "btn-success" : "btn-warning"}`}
            role="switch" // For accessibility
            aria-checked={isActive} // For accessibility
            tabIndex={0} // For accessibility
            onKeyDown={(e) => e.key === "Enter" && handleToggle()}
          >
            {isActive ? "State: ACTIVE" : "State: INACTIVE"} (Click to toggle)
          </div>
          <span className="ms-2 text-muted small">
            (Clicked {toggleClicked} times)
          </span>
        </div>

        {/* Test 3: Explicit Value on a non-input */}
        <div className="mb-3">
          <span
            data-mcp-interactive-element="explicit-value-span"
            data-mcp-element-type="display-text-with-value" // Custom type for clarity
            data-mcp-value="HelloMCP_ExplicitValue123" // Explicit value
            data-mcp-purpose="Displays text with an explicit MCP value"
            className="form-control-plaintext p-2 bg-light border rounded mb-2 d-block"
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
            className="btn btn-secondary w-100"
          >
            Test MCP Value Read
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttributeTest;
