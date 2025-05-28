from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class InteractiveElementOption(BaseModel):
    value: str
    text: str
    selected: Optional[bool] = None

class InteractiveElementInfo(BaseModel):
    id: str                                         # Value of data-mcp-interactive-element
    elementType: str = Field(..., alias="element_type")  # e.g., 'button', 'input-text', 'input-checkbox', 'select', 'input-radio'
    label: str                                      # Best available label (aria-label, textContent, placeholder, or id)
    currentValue: Optional[str] = Field(default=None, alias="current_value")  # For input fields, selected value of a select
    isChecked: Optional[bool] = Field(default=None, alias="is_checked")       # For checkboxes/radio buttons
    isDisabled: Optional[bool] = Field(default=None, alias="is_disabled")     # From data-mcp-disabled or inferred
    isReadOnly: Optional[bool] = Field(default=None, alias="is_readonly")     # From data-mcp-readonly or inferred
    purpose: Optional[str] = None                   # From data-mcp-purpose
    group: Optional[str] = None                     # From data-mcp-group
    radioGroup: Optional[str] = Field(default=None, alias="radio_group")      # From the 'name' attribute of a radio button, for grouping
    options: Optional[List[InteractiveElementOption]] = None                  # For select elements
    controls: Optional[str] = None                  # From data-mcp-controls (ID of element it controls)
    updatesContainer: Optional[str] = Field(default=None, alias="updates_container")  # From data-mcp-updates-container (ID of container it updates)
    navigatesTo: Optional[str] = Field(default=None, alias="navigates_to")    # From data-mcp-navigates-to (URL or view identifier)
    customState: Optional[str] = Field(default=None, alias="custom_state")    # From data-mcp-element-state
    customData: Optional[Dict[str, Any]] = Field(default_factory=dict, alias="custom_data")  # For user-defined custom attributes

    class Config:
        populate_by_name = True

class DisplayItem(BaseModel):
    itemId: Optional[str] = Field(default=None, alias="item_id")
    text: str
    fields: Optional[Dict[str, str]] = None

    class Config:
        populate_by_name = True

class DisplayContainerInfo(BaseModel):
    containerId: str = Field(..., alias="container_id")
    items: List[DisplayItem]
    region: Optional[str] = None
    purpose: Optional[str] = None

    class Config:
        populate_by_name = True

class PageRegionInfo(BaseModel):
    regionId: str = Field(..., alias="region_id")
    label: Optional[str] = None
    purpose: Optional[str] = None

    class Config:
        populate_by_name = True

class StatusMessageAreaInfo(BaseModel):
    containerId: str = Field(..., alias="container_id")
    messages: List[str]
    purpose: Optional[str] = None

    class Config:
        populate_by_name = True

class LoadingIndicatorInfo(BaseModel):
    elementId: str = Field(..., alias="element_id")
    isLoadingFor: str = Field(..., alias="is_loading_for")
    text: Optional[str] = None

    class Config:
        populate_by_name = True