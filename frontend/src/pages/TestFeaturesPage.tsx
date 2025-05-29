import React, { useState } from "react";

const TestFeaturesPage: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<string>("option2");
  const [radioSelection, setRadioSelection] = useState<string>("radioB");
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("Some text to clear");
  const [hoverMessageVisible, setHoverMessageVisible] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOption(event.target.value);
  };

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRadioSelection(event.target.value);
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsChecked(event.target.checked);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  return (
    // Main page card
    <div
      className="card shadow-sm"
      data-mcp-region="test-features-page"
      data-mcp-purpose="Page for testing new MCP features"
    >
      <div className="card-body">
        <h1 className="display-5 text-center mb-5">Test New MCP Features</h1>

        {/* Select Dropdown Card */}
        <div className="card mb-4" data-mcp-group="select-group">
          <div className="card-body">
            <h2 className="card-title h5">Test Select Dropdown</h2>
            <label htmlFor="test-select" className="form-label mt-2">
              Fruit Selector:
            </label>
            <select
              id="test-select"
              value={selectedOption}
              onChange={handleSelectChange}
              className="form-select"
              data-mcp-interactive-element="test-select-dropdown"
              data-mcp-element-type="select"
              data-mcp-element-label="Fruit Selector"
              data-mcp-purpose="Select a fruit from the list"
              data-mcp-custom-note="This is the main fruit selector for testing."
              data-mcp-item-priority="1"
            >
              <option value="option1" data-mcp-element-label="Apple Option">
                Apple
              </option>
              <option value="option2" data-mcp-element-label="Banana Option">
                Banana
              </option>
              <option value="option3" data-mcp-element-label="Cherry Option">
                Cherry
              </option>
            </select>
            <p className="form-text mt-2">Selected: {selectedOption}</p>
          </div>
        </div>

        {/* Radio Buttons Card */}
        <div
          className="card mb-4"
          data-mcp-group="radio-group"
          data-mcp-purpose="Choose a radio option"
        >
          <div className="card-body">
            <h2 className="card-title h5">Test Radio Buttons</h2>
            <div
              role="radiogroup"
              aria-labelledby="radio-group-label"
              className="mt-2"
            >
              <label id="radio-group-label" className="form-label">
                Favorite Radio Option:
              </label>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  id="radioA"
                  name="testRadioGroup"
                  value="radioA"
                  checked={radioSelection === "radioA"}
                  onChange={handleRadioChange}
                  data-mcp-interactive-element="radio-option-a"
                  data-mcp-element-type="radio"
                  data-mcp-element-label="Radio Option A"
                />
                <label className="form-check-label" htmlFor="radioA">
                  Option A
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  id="radioB"
                  name="testRadioGroup"
                  value="radioB"
                  checked={radioSelection === "radioB"}
                  onChange={handleRadioChange}
                  data-mcp-interactive-element="radio-option-b"
                  data-mcp-element-type="radio"
                  data-mcp-element-label="Radio Option B"
                />
                <label className="form-check-label" htmlFor="radioB">
                  Option B
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  id="radioC"
                  name="testRadioGroup"
                  value="radioC"
                  checked={radioSelection === "radioC"}
                  onChange={handleRadioChange}
                  data-mcp-interactive-element="radio-option-c"
                  data-mcp-element-type="radio"
                  data-mcp-element-label="Radio Option C"
                />
                <label className="form-check-label" htmlFor="radioC">
                  Option C
                </label>
              </div>
            </div>
            <p className="form-text mt-2">Selected: {radioSelection}</p>
          </div>
        </div>

        {/* Checkbox Card */}
        <div className="card mb-4" data-mcp-group="checkbox-group">
          <div className="card-body">
            <h2 className="card-title h5">Test Checkbox</h2>
            <div className="form-check mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="test-checkbox"
                checked={isChecked}
                onChange={handleCheckboxChange}
                data-mcp-interactive-element="test-checkbox-features"
                data-mcp-element-type="checkbox"
                data-mcp-element-label="Enable Extra Feature"
                data-mcp-purpose="Toggle an extra feature on or off"
                data-mcp-custom-note="This checkbox controls a critical test feature."
                data-mcp-item-priority="high"
              />
              <label className="form-check-label" htmlFor="test-checkbox">
                Enable Extra Feature
              </label>
            </div>
            <p className="form-text mt-2">
              Checked: {isChecked ? "Yes" : "No"}
            </p>
          </div>
        </div>

        {/* Hover Element Card */}
        <div
          className="card mb-4 position-relative"
          data-mcp-interactive-element="hover-reveal-element"
          data-mcp-element-label="Hover to see message"
          data-mcp-purpose="Reveals a message on mouse hover"
          onMouseEnter={() => setHoverMessageVisible(true)}
          onMouseLeave={() => setHoverMessageVisible(false)}
        >
          <div className="card-body text-center">
            <p className="card-text">Hover over this area!</p>
            {hoverMessageVisible && (
              <div
                className="position-absolute top-100 start-50 translate-middle-x mt-1 p-2 bg-secondary text-white rounded shadow-lg z-index-1"
                data-mcp-display-item-text
                data-mcp-display-item-id="hover-message"
                aria-live="polite"
                style={{ zIndex: 1050 }} // Ensure it's above other elements, Bootstrap modals use z-index around 1050
              >
                You hovered! MCP can trigger this.
              </div>
            )}
          </div>
        </div>

        {/* Input with Clear Card */}
        <div className="card mb-4" data-mcp-group="input-clear-group">
          <div className="card-body">
            <h2 className="card-title h5">Text Input with Clear Test</h2>
            <label htmlFor="text-input-clear" className="form-label mt-2">
              Enter text that can be cleared by MCP:
            </label>
            <input
              type="text"
              id="text-input-clear"
              value={inputValue}
              onChange={handleInputChange}
              className="form-control"
              data-mcp-interactive-element="text-input-for-clear"
              data-mcp-element-type="text-input"
              data-mcp-element-label="Text Input for Clear Action"
              data-mcp-purpose="Enter text that can be cleared by MCP"
            />
            <p className="form-text mt-2">
              Current Value: "
              <span
                data-mcp-display-item-text
                data-mcp-display-item-id="text-input-clear-value"
              >
                {inputValue}
              </span>
              "
            </p>
          </div>
        </div>

        {/* Readonly Input Card */}
        <div className="card mb-4" data-mcp-group="readonly-input-group">
          <div className="card-body">
            <h2 className="card-title h5">Readonly Input Test</h2>
            <label htmlFor="readonly-input" className="form-label mt-2">
              This input is readonly:
            </label>
            <input
              type="text"
              id="readonly-input"
              value="This value cannot be changed by user"
              readOnly
              className="form-control"
              data-mcp-interactive-element="readonly-text-input"
              data-mcp-element-type="text-input"
              data-mcp-element-label="Readonly Text Input"
              data-mcp-purpose="Displays a readonly text value"
              data-mcp-readonly="true"
            />
          </div>
        </div>

        {/* Loading Indicator and Status Message Test Card */}
        <div className="card mb-4" data-mcp-group="loading-status-group">
          <div className="card-body">
            <h2 className="card-title h5">
              Loading Indicator & Status Message
            </h2>
            <button
              id="trigger-loading-action"
              className="btn btn-info mb-3 w-100"
              onClick={() => {
                setIsLoading(true);
                setStatusMessage(null);
                setTimeout(() => {
                  setIsLoading(false);
                  setStatusMessage("Action completed successfully!");
                  setTimeout(() => setStatusMessage(null), 3000);
                }, 2000);
              }}
              data-mcp-interactive-element="trigger-loading-button"
              data-mcp-element-label="Trigger Loading Action"
              data-mcp-purpose="Simulates an action that shows loading and then a status message"
              data-mcp-updates-container="status-area" // This button updates the status-area
            >
              Simulate Action (Show Loading & Status)
            </button>

            {isLoading && (
              <div
                id="loading-spinner"
                className="alert alert-info text-center"
                data-mcp-loading-indicator-for="trigger-loading-action"
                data-mcp-purpose="Indicates that the action is in progress"
              >
                <div
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                >
                  <span className="visually-hidden">Loading...</span>
                </div>
                Processing your request...
              </div>
            )}

            <div
              id="status-area"
              className="mt-3"
              data-mcp-status-message-container="action-status-messages"
              data-mcp-purpose="Displays status messages for the simulated action"
              aria-live="polite"
            >
              {statusMessage && (
                <div className="alert alert-success">{statusMessage}</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className="stress-test-container"
        data-mcp-region="stress-test-container"
        data-mcp-purpose="Stress test container"
      >
        {Array.from({ length: 200 }).map((_, i) => (
          <div
            className="stress-test-item"
            key={i}
            data-mcp-region="stress-test-item"
            data-mcp-purpose="Stress test item"
          >
            <h2 className="card-title h5">Stress Test Item {i}</h2>
            <button
              className="btn btn-primary"
              onClick={() => {}}
              data-mcp-interactive-element="stress-test-button"
              data-mcp-element-label="Stress test button"
              data-mcp-purpose="Stress test button"
            >
              Click me
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestFeaturesPage;
