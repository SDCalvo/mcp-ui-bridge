# Placeholder for Pydantic models or dataclasses for UI elements
# e.g., InteractiveElementInfo, DisplayContainerInfo 

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class InteractiveElementOption(BaseModel):
    value: str
    text: str
    selected: Optional[bool] = None

class InteractiveElementInfo(BaseModel):
    id: str
    type: str # e.g., 'button', 'input', 'link'
    attributes: Dict[str, Any] = Field(default_factory=dict)
    custom_data: Dict[str, Any] = Field(default_factory=dict)
    name: Optional[str] = None
    value: Optional[str] = None
    is_visible: bool = True
    is_enabled: bool = True
    inner_text: Optional[str] = None
    # children: List['InteractiveElementInfo'] = Field(default_factory=list) # For tree structures

class DisplayItem(BaseModel):
    item_id: Optional[str] = Field(default=None, alias="itemId")
    text: str
    fields: Optional[Dict[str, str]] = None

    class Config:
        populate_by_name = True

class DisplayContainerInfo(BaseModel):
    container_id: str = Field(..., alias="containerId")
    items: List[DisplayItem]
    region: Optional[str] = None
    purpose: Optional[str] = None

    class Config:
        populate_by_name = True

class PageRegionInfo(BaseModel):
    region_id: str = Field(..., alias="regionId")
    label: Optional[str] = None
    purpose: Optional[str] = None

    class Config:
        populate_by_name = True

class StatusMessageAreaInfo(BaseModel):
    container_id: str = Field(..., alias="containerId")
    messages: List[str]
    purpose: Optional[str] = None

    class Config:
        populate_by_name = True

class LoadingIndicatorInfo(BaseModel):
    element_id: str = Field(..., alias="elementId")
    is_loading_for: str = Field(..., alias="isLoadingFor")
    text: Optional[str] = None

    class Config:
        populate_by_name = True 