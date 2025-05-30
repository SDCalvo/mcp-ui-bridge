import React from "react";
import { Link } from "react-router-dom";

const Navbar: React.FC = () => {
  // Helper to determine if a link is active. For Bootstrap, we'd add 'active' class.
  // This is a simple example; react-router-dom has NavLink for more robust active state handling.
  // For now, we'll manually manage it or omit 'active' for simplicity initially.

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
      <div className="container">
        <Link
          to="/"
          className="navbar-brand"
          data-mcp-interactive-element="nav-link-todo-page"
          data-mcp-element-label="Todo App Page"
          data-mcp-navigates-to="/"
        >
          MCP Test App
        </Link>
        {/* Bootstrap 5 uses data-bs-toggle and data-bs-target for toggler functionality. 
            This requires Bootstrap's JS. For a simple navbar without JS, we might not need a toggler or handle it differently.
            For now, let's assume Bootstrap JS is (or will be) available for the toggler. 
            If not, the collapse functionality won't work on small screens without custom JS. 
        */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link
                to="/"
                className="nav-link text-white" // Add 'active' class if it's the current page
                data-mcp-interactive-element="nav-link-todos"
                data-mcp-element-label="View Todos"
                data-mcp-navigates-to="/"
              >
                Todos
              </Link>
            </li>
            <li className="nav-item">
              <Link
                to="/test-features"
                className="nav-link text-white" // Add 'active' class if it's the current page
                data-mcp-interactive-element="nav-link-test-features"
                data-mcp-element-label="Test New Features"
                data-mcp-navigates-to="/test-features"
              >
                Test Features
              </Link>
            </li>
            <li className="nav-item">
              <Link
                to="/profile"
                className="nav-link text-white"
                data-mcp-interactive-element="nav-link-profile"
                data-mcp-element-label="View User Profile"
                data-mcp-navigates-to="/profile"
              >
                Profile
              </Link>
            </li>
            <li className="nav-item">
              <Link
                to="/scroll-pagination-test"
                className="nav-link text-white"
                data-mcp-interactive-element="nav-link-scroll-pagination-test"
                data-mcp-element-label="Scroll & Pagination Test"
                data-mcp-navigates-to="/scroll-pagination-test"
              >
                Scroll Test
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
