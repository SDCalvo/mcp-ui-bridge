import logging
from typing import Any, List, Optional, Dict, Union

# Playwright types
from playwright.async_api import Page, Locator, ElementHandle 

# Project models
from mcp_ui_bridge_python.models import (
    InteractiveElementInfo,
    DisplayContainerInfo,
    DisplayItem,
    PageRegionInfo,
    StatusMessageAreaInfo,
    LoadingIndicatorInfo,
    ParserResult,
    DomParserErrorType,
    CustomAttributeReader,
    DataAttributes,
    InteractiveElementOption
)

logger = logging.getLogger(__name__)

class DomParser:
    def __init__(self, page: Optional[Page], custom_attribute_readers: Optional[List[CustomAttributeReader]] = None):
        self.page: Optional[Page] = page
        self.custom_attribute_readers: List[CustomAttributeReader] = custom_attribute_readers if custom_attribute_readers is not None else []

    async def _get_element_attribute(self, element: Union[ElementHandle, Locator], attribute_name: str) -> Optional[str]:
        """Helper to get an attribute value from an ElementHandle."""
        try:
            attr_value = await element.get_attribute(attribute_name)
            return attr_value if attr_value is not None else None
        except Exception as e:
            logger.error(f"Error getting attribute {attribute_name}: {e}")
            return None

    async def _get_element_type(self, element: Union[ElementHandle, Locator]) -> str:
        """
        Determines the element type.
        Priority:
        1. data-mcp-element-type attribute
        2. Tag name (e.g., "button", "select")
        3. For <input> tags, "input-[type]" (e.g., "input-text", "input-checkbox")
        """
        explicit_type = await self._get_element_attribute(element, DataAttributes.ELEMENT_TYPE)
        if explicit_type and explicit_type.strip():
            return explicit_type.strip().lower()

        # playwright.sync_api.ElementHandle does not have a direct 'tagName' property.
        # We need to use evaluate to get it.
        tag_name_result = await element.evaluate("el => el.tagName")
        tag_name = str(tag_name_result).lower() if tag_name_result else "unknown"

        if tag_name == "input":
            type_attr = await element.get_attribute("type")
            return f"input-{type_attr or 'text'}".lower()
        return tag_name

    async def _get_element_label(self, element: Union[ElementHandle, Locator], element_id: str, element_type: str) -> str:
        """
        Determines the most appropriate label for an element.
        Priority:
        1. aria-label attribute
        2. data-mcp-element-label attribute
        3. Text content (for non-input elements)
        4. Placeholder attribute (for certain input types)
        5. Fallback to the element's ID
        """
        label = await self._get_element_attribute(element, "aria-label")
        if label and label.strip():
            return label.strip()

        mcp_label = await self._get_element_attribute(element, DataAttributes.ELEMENT_LABEL)
        if mcp_label and mcp_label.strip():
            return mcp_label.strip()
        
        if not element_type.startswith("input"):
            text_content = await element.text_content()
            if text_content:
                label = text_content.strip()
                if label:
                    return label
        
        # Consistent with PlaywrightController's placeholder logic
        if element_type.startswith("input-") and element_type not in [
            "input-button", "input-submit", "input-reset", 
            "input-checkbox", "input-radio", "input-file" 
            # input-image also doesn't typically use placeholder for labeling
        ]:
            placeholder_label = await self._get_element_attribute(element, "placeholder")
            if placeholder_label and placeholder_label.strip():
                return placeholder_label.strip()
        
        return element_id # Fallback
    
    async def _is_element_in_viewport(self, element: ElementHandle) -> bool:
        bounding_box = await element.bounding_box()
        if not bounding_box:
            return False

        viewport = await self.page.viewport_size()
        if not viewport:
            return False

        return (
            bounding_box['x'] < viewport['width'] and
            bounding_box['y'] < viewport['height'] and
            bounding_box['x'] + bounding_box['width'] > 0 and
            bounding_box['y'] + bounding_box['height'] > 0
        )

    async def _is_scrollable(self) -> bool:
        body_handle = await self.page.query_selector('body')
        if not body_handle:
            return False

        body_scroll_height = await body_handle.evaluate("body => body.scrollHeight")
        viewport_height = (await self.page.viewport_size())['height']

        return body_scroll_height > viewport_height

    async def scroll_down(self) -> None:
        await self.page.evaluate("window.scrollBy(0, window.innerHeight)")

    async def scroll_up(self) -> None:
        await self.page.evaluate("window.scrollBy(0, -window.innerHeight)")

    async def get_interactive_elements_with_state(self) -> ParserResult[List[InteractiveElementInfo]]:
        if not self.page:
            message = "DOM parsing for interactive elements failed: Page object is not available."
            logger.error(f"ERROR: {message}")
            return ParserResult(
                success=False,
                message=message,
                error_type=DomParserErrorType.PageNotAvailable,
                data=None
            )

        try:
            elements_locator: Locator = self.page.locator(
                f'[{DataAttributes.INTERACTIVE_ELEMENT}]'
            )
            count = await elements_locator.count()

            found_elements: List[InteractiveElementInfo] = []

            for i in range(count):
                element_locator_instance = elements_locator.nth(i)

                # Check if the element is in the viewport
                element_handle = await element_locator_instance.element_handle()
                if not element_handle or not await self._is_element_in_viewport(element_handle):
                    continue

                element_id_attr = await self._get_element_attribute(
                    element_locator_instance, DataAttributes.INTERACTIVE_ELEMENT
                )

                if not element_id_attr:
                    logger.warning(
                        "WARN: Found an element with data-mcp-interactive-element attribute but no value. Skipping."
                    )
                    continue

                element_id = element_id_attr

                element_type = await self._get_element_type(element_locator_instance)
                label = await self._get_element_label(element_locator_instance, element_id, element_type)

                current_value: Optional[str] = None
                is_checked: Optional[bool] = None
                is_disabled: Optional[bool] = None
                is_read_only: Optional[bool] = None
                options_list: Optional[List[InteractiveElementOption]] = None
                radio_group: Optional[str] = None

                current_value = await self._get_element_attribute(element_locator_instance, DataAttributes.VALUE)

                mcp_disabled = await self._get_element_attribute(element_locator_instance, DataAttributes.DISABLED_STATE)
                if mcp_disabled is not None:
                    is_disabled = mcp_disabled == "true"
                else:
                    is_disabled = await element_locator_instance.is_disabled()

                mcp_read_only = await self._get_element_attribute(element_locator_instance, DataAttributes.READONLY_STATE)
                if mcp_read_only is not None:
                    is_read_only = mcp_read_only == "true"
                else:
                    if element_type.startswith("input-") or element_type == "textarea" or element_type == "select":
                        if is_disabled:
                            is_read_only = await element_locator_instance.evaluate("el => el.readOnly") or False
                        else:
                            is_read_only = not (await element_locator_instance.is_editable())

                if element_type.startswith("input-"):
                    if element_type in ["input-checkbox", "input-radio"]:
                        is_checked = await element_locator_instance.is_checked()
                        if element_type == "input-radio":
                            radio_group = await element_locator_instance.get_attribute("name") or None
                    elif element_type not in [
                        "input-button", "input-submit", "input-reset", "input-file"
                    ]:
                        if current_value is None: 
                            try:
                                current_value = await element_locator_instance.input_value()
                            except Exception as e:
                                logger.warning(f"WARN: Could not retrieve input_value for {element_id} (type: {element_type}) (async): {e}")
                                current_value = None
                elif element_type == "select":
                    # For select, get_attribute('value') on the select element itself usually works for current value
                    if current_value is None:
                         current_value = await element_locator_instance.evaluate("el => el.value")

                    option_elements_locator: Locator = element_locator_instance.locator("option")
                    option_count = await option_elements_locator.count()
                    options_list = []
                    for j in range(option_count):
                        option_loc = option_elements_locator.nth(j)
                        value = await option_loc.get_attribute("value") or ""
                        text_content_result = await option_loc.text_content()
                        text = text_content_result.strip() if text_content_result else ""
                        selected = await option_loc.evaluate("el => el.selected")

                        options_list.append(InteractiveElementOption(value=value, text=text, selected=bool(selected)))

                element_info_data: Dict[str, Any] = {
                    "id": element_id,
                    "elementType": element_type, # Changed to 'elementType' to match Pydantic model
                    "label": label,
                    "isDisabled": is_disabled,
                    "isReadOnly": is_read_only,
                }

                if current_value is not None: element_info_data["currentValue"] = current_value
                if is_checked is not None: element_info_data["isChecked"] = is_checked
                if options_list is not None: element_info_data["options"] = [opt.model_dump() for opt in options_list]
                if radio_group is not None: element_info_data["radioGroup"] = radio_group

                for attr_key, data_attr_name in [
                    ("purpose", DataAttributes.PURPOSE),
                    ("group", DataAttributes.GROUP),
                    ("controls", DataAttributes.CONTROLS),
                    ("updatesContainer", DataAttributes.UPDATES_CONTAINER),
                    ("navigatesTo", DataAttributes.NAVIGATES_TO),
                    ("customState", DataAttributes.ELEMENT_STATE),
                ]:
                    attr_val = await self._get_element_attribute(element_locator_instance, data_attr_name)
                    if attr_val is not None:
                        element_info_data[attr_key] = attr_val

                if self.custom_attribute_readers:
                    element_info_data["customData"] = {}
                    for reader in self.custom_attribute_readers:
                        raw_value = await self._get_element_attribute(element_locator_instance, reader.attribute_name)
                        try:
                            if reader.process_value:
                                # Get ElementHandle for advanced processing (matching TypeScript feature parity)
                                element_handle = await element_locator_instance.element_handle()
                                processed_value = reader.process_value(
                                    raw_value if raw_value is not None else None,
                                    element_handle
                                )
                                element_info_data["customData"][reader.output_key] = processed_value
                            elif raw_value is not None:
                                element_info_data["customData"][reader.output_key] = raw_value
                        except Exception as e:
                            logger.warning(f"WARN: Error processing custom attribute \"{reader.attribute_name}\" for element \"{element_id}\" with key \"{reader.output_key}\" (async): {e}")
                            element_info_data["customData"][reader.output_key] = "ERROR_PROCESSING_ATTRIBUTE"

                try:
                    element_info = InteractiveElementInfo(**element_info_data)
                    found_elements.append(element_info)
                except Exception as pydantic_error: 
                    logger.error(f"ERROR: Pydantic validation failed for element {element_id} (async): {pydantic_error}. Data: {element_info_data}")
                    continue

            # Check if scrolling is possible
            scrollable = await self._is_scrollable()
            if scrollable:
                logger.info("More elements are available beyond the current viewport. Scrolling is possible.")

            success_message = f"Successfully parsed {len(found_elements)} interactive elements with state (async)."
            return ParserResult(success=True, message=success_message, data=found_elements)

        except Exception as error:
            error_message = "An error occurred while parsing interactive elements with state (async)."
            logger.error(f"ERROR: {error_message} - {error}")
            return ParserResult(
                success=False,
                message=f"{error_message} Error: {str(error)}",
                error_type=DomParserErrorType.ParsingFailed,
                data=None
            )

    async def get_structured_data(self) -> ParserResult[Dict[str, Any]]:
        if not self.page:
            message = "DOM parsing for structured data failed: Page object is not available."
            logger.error(f"ERROR: {message}")
            return ParserResult(
                success=False,
                message=message,
                error_type=DomParserErrorType.PageNotAvailable,
                data=None
            )
        try:
            containers_result = await self._find_display_containers_internal()
            regions_result = await self._find_page_regions_internal()
            status_messages_result = await self._find_status_message_areas_internal()
            loading_indicators_result = await self._find_loading_indicators_internal()

            structured_data_dict = {
                "containers": [container.model_dump() for container in containers_result.data] if containers_result.success and containers_result.data is not None else [],
                "regions": [region.model_dump() for region in regions_result.data] if regions_result.success and regions_result.data is not None else [],
                "statusMessages": [status.model_dump() for status in status_messages_result.data] if status_messages_result.success and status_messages_result.data is not None else [],
                "loadingIndicators": [indicator.model_dump() for indicator in loading_indicators_result.data] if loading_indicators_result.success and loading_indicators_result.data is not None else []
            }

            message = "Successfully retrieved all structured data (async)."
            return ParserResult(success=True, message=message, data=structured_data_dict)
        except Exception as error:
            error_message = "An error occurred while parsing structured data (async)."
            logger.error(f"ERROR: {error_message} - {error}")
            return ParserResult(
                success=False,
                message=f"{error_message} Error: {str(error)}",
                error_type=DomParserErrorType.ParsingFailed,
                data=None
            )

    async def _find_display_containers_internal(self) -> ParserResult[List[DisplayContainerInfo]]:
        if not self.page:
            return ParserResult(success=False, message="Page not available", error_type=DomParserErrorType.PageNotAvailable, data=None)
        
        found_containers: List[DisplayContainerInfo] = []
        try:
            container_locator: Locator = self.page.locator(f'[{DataAttributes.DISPLAY_CONTAINER}]')
            container_count = await container_locator.count()

            for i in range(container_count):
                container_element_locator = container_locator.nth(i)

                container_id_attr = await self._get_element_attribute(container_element_locator, DataAttributes.DISPLAY_CONTAINER)
                if not container_id_attr: 
                    logger.warning("WARN: Found an element with data-display-container attribute but no value. Skipping.")
                    continue
                container_id = container_id_attr

                region = await self._get_element_attribute(container_element_locator, DataAttributes.REGION)
                purpose = await self._get_element_attribute(container_element_locator, DataAttributes.PURPOSE)

                item_locator: Locator = container_element_locator.locator(f'[{DataAttributes.DISPLAY_ITEM_TEXT}]')
                item_count = await item_locator.count()

                items_list: List[DisplayItem] = []
                for j in range(item_count):
                    item_element_locator = item_locator.nth(j)
                    item_id = await self._get_element_attribute(item_element_locator, DataAttributes.DISPLAY_ITEM_ID)
                    text_content_result = await item_element_locator.text_content()
                    text_content = text_content_result.strip() if text_content_result else ""

                    fields: Dict[str, str] = {}
                    field_locator: Locator = item_element_locator.locator(f'[{DataAttributes.FIELD_NAME}]')
                    field_count = await field_locator.count()
                    for k in range(field_count):
                        field_element_locator = field_locator.nth(k)
                        field_name = await self._get_element_attribute(field_element_locator, DataAttributes.FIELD_NAME)
                        field_value_result = await field_element_locator.text_content()
                        field_value = field_value_result.strip() if field_value_result else ""
                        if field_name and field_value is not None:
                            fields[field_name] = field_value
                    
                    display_item_data = {"text": text_content}
                    if item_id: display_item_data["item_id"] = item_id
                    if fields: display_item_data["fields"] = fields
                    
                    items_list.append(DisplayItem(**display_item_data))
                
                found_containers.append(DisplayContainerInfo(
                    container_id=container_id, 
                    items=items_list, 
                    region=region, 
                    purpose=purpose
                ))
            
            success_message = f"Successfully parsed {len(found_containers)} display containers (async)."
            return ParserResult(success=True, message=success_message, data=found_containers)
        except Exception as error:
            error_message = "An error occurred while parsing display containers (async)."
            logger.error(f"ERROR: {error_message} - {error}")
            return ParserResult(success=False, message=f"{error_message} Error: {str(error)}", error_type=DomParserErrorType.ParsingFailed, data=None)

    async def _find_page_regions_internal(self) -> ParserResult[List[PageRegionInfo]]:
        if not self.page:
            return ParserResult(success=False, message="Page not available", error_type=DomParserErrorType.PageNotAvailable, data=None)
        found_regions: List[PageRegionInfo] = []
        try:
            region_locator: Locator = self.page.locator(f'[{DataAttributes.REGION}]')
            count = await region_locator.count()

            for i in range(count):
                element_locator_instance = region_locator.nth(i)

                region_id_attr = await self._get_element_attribute(element_locator_instance, DataAttributes.REGION)
                if not region_id_attr:
                    logger.warning("WARN: Found an element with data-mcp-region attribute but no value. Skipping.")
                    continue
                region_id = region_id_attr
                
                element_type = await self._get_element_type(element_locator_instance) 
                label = await self._get_element_label(element_locator_instance, region_id, element_type)
                purpose = await self._get_element_attribute(element_locator_instance, DataAttributes.PURPOSE)

                found_regions.append(PageRegionInfo(region_id=region_id, label=label, purpose=purpose))
            
            success_message = f"Successfully parsed {len(found_regions)} page regions (async)."
            return ParserResult(success=True, message=success_message, data=found_regions)
        except Exception as error:
            error_message = "An error occurred while parsing page regions (async)."
            logger.error(f"ERROR: {error_message} - {error}")
            return ParserResult(success=False, message=f"{error_message} Error: {str(error)}", error_type=DomParserErrorType.ParsingFailed, data=None)

    async def _find_status_message_areas_internal(self) -> ParserResult[List[StatusMessageAreaInfo]]:
        if not self.page:
            return ParserResult(success=False, message="Page not available", error_type=DomParserErrorType.PageNotAvailable, data=None)
        found_areas: List[StatusMessageAreaInfo] = []
        try:
            area_locator: Locator = self.page.locator(f'[{DataAttributes.STATUS_MESSAGE_CONTAINER}]')
            count = await area_locator.count()

            for i in range(count):
                element_locator_instance = area_locator.nth(i)

                container_id_attr = await self._get_element_attribute(element_locator_instance, DataAttributes.STATUS_MESSAGE_CONTAINER)
                if not container_id_attr:
                    logger.warning("WARN: Found an element with data-mcp-status-message-container attribute but no value. Skipping.")
                    continue
                container_id = container_id_attr
                
                purpose = await self._get_element_attribute(element_locator_instance, DataAttributes.PURPOSE)
                text_content_result = await element_locator_instance.text_content()
                messages = [text_content_result.strip()] if text_content_result and text_content_result.strip() else []
                
                found_areas.append(StatusMessageAreaInfo(container_id=container_id, messages=messages, purpose=purpose))

            success_message = f"Successfully parsed {len(found_areas)} status message areas (async)."
            return ParserResult(success=True, message=success_message, data=found_areas)
        except Exception as error:
            error_message = "An error occurred while parsing status message areas (async)."
            logger.error(f"ERROR: {error_message} - {error}")
            return ParserResult(success=False, message=f"{error_message} Error: {str(error)}", error_type=DomParserErrorType.ParsingFailed, data=None)

    async def _find_loading_indicators_internal(self) -> ParserResult[List[LoadingIndicatorInfo]]:
        if not self.page:
            return ParserResult(success=False, message="Page not available", error_type=DomParserErrorType.PageNotAvailable, data=None)
        found_indicators: List[LoadingIndicatorInfo] = []
        try:
            indicator_locator: Locator = self.page.locator(f'[{DataAttributes.LOADING_INDICATOR_FOR}]')
            count = await indicator_locator.count()

            for i in range(count):
                element_locator_instance = indicator_locator.nth(i)

                element_id = await self._get_element_attribute(element_locator_instance, DataAttributes.INTERACTIVE_ELEMENT)
                if not element_id:
                    element_id = await element_locator_instance.get_attribute("id")
                    if not element_id:
                        element_id = f"loading-indicator-{i}" 
                
                is_loading_for = await self._get_element_attribute(element_locator_instance, DataAttributes.LOADING_INDICATOR_FOR)
                if not is_loading_for:
                    logger.warning("WARN: Found an element with data-mcp-loading-indicator-for attribute but no value. Skipping.")
                    continue
                
                text_content_result = await element_locator_instance.text_content()
                text = text_content_result.strip() if text_content_result and text_content_result.strip() else None

                found_indicators.append(LoadingIndicatorInfo(element_id=element_id, is_loading_for=is_loading_for, text=text))
            
            success_message = f"Successfully parsed {len(found_indicators)} loading indicators (async)."
            return ParserResult(success=True, message=success_message, data=found_indicators)
        except Exception as error:
            error_message = "An error occurred while parsing loading indicators (async)."
            logger.error(f"ERROR: {error_message} - {error}")
            return ParserResult(success=False, message=f"{error_message} Error: {str(error)}", error_type=DomParserErrorType.ParsingFailed, data=None)

    # End of DomParser class
    pass 