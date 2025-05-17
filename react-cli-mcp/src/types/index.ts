// Placeholder for shared type definitions
export {};

export interface InteractiveElementInfo {
  id: string; // Value of data-interactive-element
  tagName: string;
  // We can add more properties like textContent, attributes, etc. later
}

export interface DisplayItem {
  text: string; // textContent of the element
  // id?: string; // Optional: value of data-display-item-text if needed for more specific targeting
}

export interface DisplayContainerInfo {
  containerId: string; // Value of data-display-container
  items: DisplayItem[];
}
