import React, { useState } from "react";

const UserProfilePage: React.FC = () => {
  const [displayName, setDisplayName] = useState<string>("User_123");
  const [language, setLanguage] = useState<string>("en");
  const [subscribed, setSubscribed] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSave = () => {
    setStatusMessage(null); // Clear previous message
    // Simulate API call
    setTimeout(() => {
      setStatusMessage("Profile saved successfully!");
      setTimeout(() => setStatusMessage(null), 3000); // Clear message after 3s
    }, 500);
  };

  return (
    <div
      className="card shadow-sm"
      data-mcp-region="user-profile-page"
      data-mcp-purpose="View and edit user profile information"
    >
      <div className="card-body">
        <h1 className="display-5 text-center mb-5">User Profile</h1>

        {/* Email (Display Only) */}
        <div className="mb-3" data-mcp-group="user-email-group">
          <label htmlFor="profile-email" className="form-label">
            Email:
          </label>
          <p
            id="profile-email"
            className="form-control-plaintext"
            data-mcp-display-item-text
            data-mcp-display-item-id="user-email-display"
            data-mcp-element-label="User Email"
          >
            user@example.com
          </p>
        </div>

        {/* Display Name */}
        <div className="mb-3" data-mcp-group="user-display-name-group">
          <label htmlFor="profile-display-name" className="form-label">
            Display Name:
          </label>
          <input
            type="text"
            id="profile-display-name"
            className="form-control"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            data-mcp-interactive-element="profile-display-name-input"
            data-mcp-element-type="text-input"
            data-mcp-element-label="User Display Name"
            data-mcp-purpose="Enter your preferred display name"
          />
        </div>

        {/* Preferred Language */}
        <div className="mb-3" data-mcp-group="user-language-group">
          <label htmlFor="profile-language" className="form-label">
            Preferred Language:
          </label>
          <select
            id="profile-language"
            className="form-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            data-mcp-interactive-element="profile-language-select"
            data-mcp-element-type="select"
            data-mcp-element-label="Preferred Language Selector"
            data-mcp-purpose="Select your preferred language"
          >
            <option value="en" data-mcp-element-label="English Option">
              English
            </option>
            <option value="es" data-mcp-element-label="Spanish Option">
              Español
            </option>
            <option value="fr" data-mcp-element-label="French Option">
              Français
            </option>
          </select>
        </div>

        {/* Subscribe to Newsletter */}
        <div
          className="mb-4 form-check"
          data-mcp-group="user-subscription-group"
        >
          <input
            type="checkbox"
            id="profile-subscribe"
            className="form-check-input"
            checked={subscribed}
            onChange={(e) => setSubscribed(e.target.checked)}
            data-mcp-interactive-element="profile-subscribe-checkbox"
            data-mcp-element-type="checkbox"
            data-mcp-element-label="Subscribe to Newsletter"
            data-mcp-purpose="Toggle newsletter subscription"
          />
          <label htmlFor="profile-subscribe" className="form-check-label">
            Subscribe to our newsletter
          </label>
        </div>

        {/* Save Button */}
        <button
          type="button"
          className="btn btn-primary w-100 mb-3"
          onClick={handleSave}
          data-mcp-interactive-element="profile-save-button"
          data-mcp-element-label="Save Profile Button"
          data-mcp-purpose="Save changes to user profile"
          data-mcp-updates-container="profile-status-area"
        >
          Save Profile
        </button>

        {/* Status Message Area */}
        <div
          id="profile-status-area"
          data-mcp-status-message-container="user-profile-status"
          data-mcp-purpose="Displays status messages for profile actions"
          aria-live="polite"
          className="mt-3"
        >
          {statusMessage && (
            <div className="alert alert-success">{statusMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
