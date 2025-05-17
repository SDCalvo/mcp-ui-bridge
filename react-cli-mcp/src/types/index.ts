// Placeholder for shared type definitions
export {};

export interface InteractiveElementInfo {
  id: string; // Value of data-mcp-interactive-element
  elementType: string; // e.g., 'button', 'input-text', 'input-checkbox'
  label: string; // Best available label (aria-label, textContent, placeholder, or id)
  currentValue?: string; // For input fields
  isChecked?: boolean; // For checkboxes
  // We can add more properties like attributes, etc. later
}

export interface DisplayItem {
  text: string; // textContent of the element
  // id?: string; // Optional: value of data-display-item-text if needed for more specific targeting
}

export interface DisplayContainerInfo {
  containerId: string; // Value of data-display-container
  items: DisplayItem[];
}
