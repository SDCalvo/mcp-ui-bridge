import React, { useState } from "react";

const ScrollPaginationTestPage: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);

  const handleButtonClick = (buttonId: string) => {
    setResults((prev) => [
      ...prev,
      `Clicked: ${buttonId} at ${new Date().toLocaleTimeString()}`,
    ]);
  };

  const handleInputChange = (inputId: string, value: string) => {
    setResults((prev) => [...prev, `Input ${inputId}: "${value}"`]);
  };

  return (
    <div
      className="container-fluid"
      data-mcp-region="scroll-pagination-test-page"
      data-mcp-purpose="Test page for scroll and pagination functionality"
    >
      <h1 className="display-4 text-center mb-4">
        Scroll & Pagination Test Page
      </h1>

      <div className="alert alert-info mb-4">
        <h5>Testing Instructions:</h5>
        <ul className="mb-0">
          <li>
            <strong>Pagination Test:</strong> 25+ of each element type visible
            in viewport - use pagination commands
          </li>
          <li>
            <strong>Element Types:</strong> Interactive Elements, Display
            Containers, Page Regions, Status Areas, Loading Indicators
          </li>
          <li>
            <strong>Scroll Test:</strong> Additional content below requires
            scrolling to access
          </li>
          <li>
            <strong>Expected:</strong> LLM should use pagination for viewport
            elements, scrolling for off-screen content
          </li>
        </ul>
      </div>

      {/* INTERACTIVE ELEMENTS (30 total) */}
      <div className="card mb-4" data-mcp-region="interactive-elements-section">
        <div className="card-header">
          <h3>Interactive Elements (30 total)</h3>
          <small className="text-muted">
            Buttons and inputs for interaction testing
          </small>
        </div>
        <div className="card-body">
          <div className="row">
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="col-2 mb-2">
                {i < 20 ? (
                  <button
                    className="btn btn-primary btn-sm w-100"
                    onClick={() => handleButtonClick(`btn-${i + 1}`)}
                    data-mcp-interactive-element={`btn-${i + 1}`}
                    data-mcp-element-label={`Button ${i + 1}`}
                    data-mcp-purpose={`Test button ${i + 1}`}
                  >
                    Btn {i + 1}
                  </button>
                ) : (
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder={`Input ${i + 1}`}
                    onChange={(e) =>
                      handleInputChange(`input-${i + 1}`, e.target.value)
                    }
                    data-mcp-interactive-element={`input-${i + 1}`}
                    data-mcp-element-label={`Input ${i + 1}`}
                    data-mcp-purpose={`Test input ${i + 1}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DISPLAY CONTAINERS (25 total) */}
      <div className="card mb-4" data-mcp-region="display-containers-section">
        <div className="card-header">
          <h3>Display Containers (25 total)</h3>
          <small className="text-muted">Containers with display items</small>
        </div>
        <div className="card-body">
          <div className="row">
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} className="col-3 mb-2">
                <div
                  className="border rounded p-2"
                  data-mcp-display-container={`container-${i + 1}`}
                  data-mcp-purpose={`Display container ${i + 1}`}
                >
                  <strong className="small">Container {i + 1}</strong>
                  {Array.from({ length: 2 }, (_, j) => (
                    <div
                      key={j}
                      data-mcp-display-item-text
                      data-mcp-display-item-id={`item-${i + 1}-${j + 1}`}
                    >
                      <div className="small">
                        <span data-mcp-field-name="name">Item {j + 1}</span>
                        <span
                          className="text-muted"
                          data-mcp-field-name="value"
                        >
                          {" "}
                          - Value {j + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE REGIONS (30 total) */}
      <div className="card mb-4" data-mcp-region="page-regions-section">
        <div className="card-header">
          <h3>Page Regions (30 total)</h3>
          <small className="text-muted">Various page regions for testing</small>
        </div>
        <div className="card-body">
          <div className="row">
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="col-2 mb-2">
                <div
                  className="bg-light border rounded p-2 text-center"
                  data-mcp-region={`region-${i + 1}`}
                  data-mcp-purpose={`Page region ${i + 1}`}
                >
                  <small>Region {i + 1}</small>
                  <div className="small text-muted">Content here</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATUS MESSAGE AREAS (25 total) */}
      <div className="card mb-4" data-mcp-region="status-areas-section">
        <div className="card-header">
          <h3>Status Message Areas (25 total)</h3>
          <small className="text-muted">Status message containers</small>
        </div>
        <div className="card-body">
          <div className="row">
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} className="col-3 mb-2">
                <div
                  className="alert alert-secondary py-2"
                  data-mcp-status-message-container={`status-${i + 1}`}
                  data-mcp-purpose={`Status area ${i + 1}`}
                >
                  <small>
                    <strong>Status {i + 1}:</strong>
                  </small>
                  <div className="small">Ready</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LOADING INDICATORS (25 total) */}
      <div className="card mb-4" data-mcp-region="loading-indicators-section">
        <div className="card-header">
          <h3>Loading Indicators (25 total)</h3>
          <small className="text-muted">Loading indicators for testing</small>
        </div>
        <div className="card-body">
          <div className="row">
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} className="col-2 mb-2 text-center">
                <div className="border rounded p-2">
                  <small>
                    <strong>Loader {i + 1}</strong>
                  </small>
                  <div
                    data-mcp-loading-indicator-for={`section-${i + 1}`}
                    data-mcp-interactive-element={`loader-${i + 1}`}
                  >
                    <div
                      className="spinner-border spinner-border-sm text-primary"
                      role="status"
                    >
                      <span className="visually-hidden">
                        Loading {i + 1}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RESULTS DISPLAY */}
      <div
        className="card mb-4"
        data-mcp-status-message-container="results-display"
        data-mcp-purpose="Shows test interaction results"
      >
        <div className="card-header">
          <h5>Test Results</h5>
        </div>
        <div
          className="card-body"
          style={{ maxHeight: "200px", overflowY: "auto" }}
        >
          {results.length === 0 ? (
            <p className="text-muted">No interactions yet...</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {results.map((result, index) => (
                <li key={index} className="small text-success">
                  {result}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* SCROLL SEPARATOR */}
      <div className="text-center py-5 bg-light border-top border-bottom">
        <h2 className="text-muted">⬇️ SCROLL DOWN FOR MORE CONTENT ⬇️</h2>
        <p className="text-muted">
          The content below requires scrolling to access
        </p>
      </div>

      {/* SPACER TO FORCE SCROLLING */}
      <div
        style={{ height: "100vh" }}
        className="d-flex align-items-center justify-content-center bg-light"
        data-mcp-region="spacer-region"
      >
        <div className="text-center">
          <h3 className="text-muted">Spacer Area</h3>
          <p className="text-muted">
            This space forces scrolling to reach the content below
          </p>
        </div>
      </div>

      {/* BELOW VIEWPORT SECTION - Requires scrolling */}
      <div
        className="card mb-4"
        data-mcp-region="scroll-elements-section"
        data-mcp-purpose="Contains interactive elements that require scrolling to access"
      >
        <div className="card-header bg-warning">
          <h3>Scroll Elements Section (Scroll Test)</h3>
          <small className="text-dark">
            These elements require scrolling down to access
          </small>
        </div>
        <div className="card-body">
          <div className="row">
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="col-4 mb-2">
                <button
                  className="btn btn-success btn-sm w-100"
                  onClick={() => handleButtonClick(`scroll-btn-${i + 1}`)}
                  data-mcp-interactive-element={`scroll-btn-${i + 1}`}
                  data-mcp-element-label={`Scroll Button ${i + 1}`}
                  data-mcp-purpose={`Execute scroll action ${i + 1}`}
                >
                  Scroll Action {i + 1}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Spacer */}
      <div
        style={{ height: "50vh" }}
        className="d-flex align-items-center justify-content-center"
        data-mcp-region="bottom-spacer-region"
        data-mcp-purpose="Bottom spacer and completion indicator"
      >
        <div className="text-center">
          <h4 className="text-success">🎉 End of Test Page 🎉</h4>
          <p className="text-muted">
            You've successfully scrolled to the bottom!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScrollPaginationTestPage;
