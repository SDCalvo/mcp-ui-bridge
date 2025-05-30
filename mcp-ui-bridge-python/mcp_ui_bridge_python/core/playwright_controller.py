from typing import Any, Optional, Dict, List, Union

# Import official models and enums
from mcp_ui_bridge_python.models import (
    ActionResult,
    PlaywrightErrorType,
    InteractiveElementInfo, # This will be the Pydantic model
    CustomAttributeReader,  # This will be the Pydantic model
    DataAttributes,
    AutomationInterface as ModelAutomationInterface # Alias to avoid naming conflict
)

# Import Playwright async API
from playwright.async_api import async_playwright, Browser, Page, BrowserContext, Locator, Playwright
import logging

logger = logging.getLogger(__name__)

class PlaywrightController:
    DEFAULT_TIMEOUT: int = 5000  # ms

    def __init__(self, launch_options: Optional[Dict[str, Any]] = None, custom_attribute_readers: Optional[List[CustomAttributeReader]] = None):
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        
        self.launch_options: Dict[str, Any] = launch_options if launch_options is not None else {"headless": True}
        self.custom_attribute_readers: List[CustomAttributeReader] = custom_attribute_readers if custom_attribute_readers is not None else []
        self._active = False

    async def launch(self) -> ActionResult:
        """Launch the browser with a new page."""
        try:
            if self.playwright:
                message = "Browser already initialized."
                logger.warning(message)
                return ActionResult(success=False, message=message)

            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(**self.launch_options)
            self.context = await self.browser.new_context()
            self.page = await self.context.new_page()

            message = "Browser launched successfully."
            return ActionResult(success=True, message=message)

        except Exception as error:
            err_message = "Failed to launch browser"
            logger.error(f"{err_message}. Error type: {type(error)}")
            logger.error(f"Error details: {str(error)}")
            logger.error(f"Error args: {error.args}")

            # Attempt cleanup on failure
            if self.browser:
                try:
                    await self.browser.close()
                    self.browser = None
                except Exception as close_error:
                    logger.error(f"Failed to close browser after launch failure: {str(close_error)}")

            if self.playwright:
                try:
                    await self.playwright.stop()
                    self.playwright = None
                except Exception as stop_error:
                    logger.error(f"Failed to stop Playwright after launch failure: {str(stop_error)}")

            return ActionResult(
                success=False,
                message=f"{err_message}: {str(error)}",
                error_type=PlaywrightErrorType.BrowserLaunchFailed
            )

    async def _get_attribute(self, locator: Locator, attribute_name: str) -> Optional[str]:
        value = await locator.get_attribute(attribute_name)
        return value if value is not None else None

    async def navigate(self, url: str, wait_until: str = "networkidle", timeout: int = 30000) -> ActionResult:
        """Navigate to a URL."""
        if not self.page:
            message = "Cannot navigate: Page not initialized."
            logger.error(message)
            return ActionResult(success=False, message=message, error_type=PlaywrightErrorType.PageNotAvailable)

        try:
            str_url = str(url) if not isinstance(url, str) else url
            await self.page.goto(str_url, wait_until=wait_until, timeout=timeout)

            message = f"Successfully navigated to {str_url}"
            return ActionResult(success=True, message=message)

        except Exception as error:
            err_message = f"Failed to navigate to {url}"
            logger.error(f"{err_message} Details: {str(error)}")
            return ActionResult(
                success=False,
                message=f"{err_message}: {str(error)}",
                error_type=PlaywrightErrorType.NavigationFailed
            )

    def get_page(self) -> Optional[Page]:
        if not self.page:
            logger.warning("WARNING: get_page() called but page is not initialized.")
        return self.page

    async def close(self) -> ActionResult:
        if not self.browser and not self.playwright:
            message = "Browser close skipped: Not launched or already closed (async)."
            logger.warning(message)
            return ActionResult(success=True, message=message)
        
        logger.info("Attempting to close browser (async)...")
        try:
            if self.browser:
                await self.browser.close()
            if self.playwright: 
                 await self.playwright.stop()
            
            self.browser = None
            self.context = None
            self.page = None
            self.playwright = None
            self._active = False
            message = "Browser and Playwright resources closed successfully (async)."
            logger.info(message)
            return ActionResult(success=True, message=message)
        except Exception as error:
            err_message = "Failed to close the browser or Playwright (async)."
            logger.exception(err_message)
            self.browser = None 
            self.context = None
            self.page = None
            if self.playwright: # Attempt to stop playwright even if browser close failed
                try:
                    await self.playwright.stop()
                except Exception as e_stop:
                    logger.exception("Failed to stop Playwright instance during close error handling (async)")
            self.playwright = None
            self._active = False
            return ActionResult(
                success=False,
                message=f"{err_message} Error: {str(error)}",
                error_type=PlaywrightErrorType.BrowserCloseFailed,
            )
    
    async def __aenter__(self):
        await self.launch()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def click(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element = self.page.locator(selector).first
            if await element.count() == 0:
                return ActionResult(success=False, message=f"Element with ID '{element_id}' not found", error_type=PlaywrightErrorType.ElementNotFound)
            await element.wait_for(state="visible", timeout=actual_timeout)
            await element.click(timeout=actual_timeout)
            return ActionResult(success=True, message=f"Successfully clicked element with ID: {element_id}")
        except Exception as error:
            err_message = f"Failed to click element with ID '{element_id}' (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
                err_message = f"Timeout waiting for element '{element_id}' to be visible or clickable (async)."
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def type_text(self, element_id: str, text: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element = self.page.locator(selector).first
            if await element.count() == 0:
                return ActionResult(success=False, message=f"Type failed: Element with ID '{element_id}' not found.", error_type=PlaywrightErrorType.ElementNotFound)
            await element.wait_for(state="visible", timeout=actual_timeout)
            await element.fill(text, timeout=actual_timeout)
            return ActionResult(success=True, message=f'Successfully typed "{text}" into element with ID: {element_id}.')
        except Exception as error:
            err_message = f"Failed to type into element with ID '{element_id}' (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def select_option(self, element_id: str, value: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element = self.page.locator(selector).first
            if await element.count() == 0:
                return ActionResult(success=False, message=f"Select option failed: Element with ID '{element_id}' not found.", error_type=PlaywrightErrorType.ElementNotFound)
            await element.wait_for(state="visible", timeout=actual_timeout)
            await element.select_option(value, timeout=actual_timeout)
            return ActionResult(success=True, message=f'Successfully selected option "{value}" in element with ID: {element_id}.')
        except Exception as error:
            err_message = f"Failed to select option in element with ID '{element_id}' (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
            elif "No option found for value" in str(error):
                 error_type = PlaywrightErrorType.OptionNotFound
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def check_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element = self.page.locator(selector).first
            if await element.count() == 0:
                return ActionResult(success=False, message=f"Check element failed: Element with ID '{element_id}' not found.", error_type=PlaywrightErrorType.ElementNotFound)
            await element.wait_for(state="visible", timeout=actual_timeout)
            await element.check(timeout=actual_timeout)
            return ActionResult(success=True, message=f"Successfully checked element with ID: {element_id}.")
        except Exception as error:
            err_message = f"Failed to check element with ID '{element_id}' (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def uncheck_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element = self.page.locator(selector).first
            if await element.count() == 0:
                return ActionResult(success=False, message=f"Uncheck element failed: Element with ID '{element_id}' not found.", error_type=PlaywrightErrorType.ElementNotFound)
            await element.wait_for(state="visible", timeout=actual_timeout)
            await element.uncheck(timeout=actual_timeout)
            return ActionResult(success=True, message=f"Successfully unchecked element with ID: {element_id}.")
        except Exception as error:
            err_message = f"Failed to uncheck element with ID '{element_id}' (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def select_radio_button(self, radio_button_id_in_group: str, value_to_select: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        group_member_selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{radio_button_id_in_group}"]'
        try:
            group_member_element = self.page.locator(group_member_selector).first
            if await group_member_element.count() == 0:
                return ActionResult(success=False, message=f"Select radio button failed: Initial element with ID '{radio_button_id_in_group}' not found.", error_type=PlaywrightErrorType.ElementNotFound)
            await group_member_element.wait_for(state="visible", timeout=actual_timeout)
            
            radio_group_name = await group_member_element.get_attribute("name")
            if not radio_group_name:
                return ActionResult(success=False, message=f"Select radio button failed: Element with ID '{radio_button_id_in_group}' does not have a 'name' attribute.", error_type=PlaywrightErrorType.AttributeNotFound)

            target_radio_selector = f'input[type="radio"][name="{radio_group_name}"][value="{value_to_select}"]'
            target_radio_element = self.page.locator(target_radio_selector).first

            if await target_radio_element.count() == 0:
                return ActionResult(success=False, message=f"Select radio button failed: Radio button with name '{radio_group_name}' and value '{value_to_select}' not found.", error_type=PlaywrightErrorType.OptionNotFound)

            await target_radio_element.wait_for(state="visible", timeout=actual_timeout)
            await target_radio_element.click(timeout=actual_timeout)
            return ActionResult(success=True, message=f'Successfully selected radio button with value "{value_to_select}" in group "{radio_group_name}".')
        except Exception as error:
            err_message = "Failed to select radio button (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def hover_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element = self.page.locator(selector).first
            if await element.count() == 0:
                return ActionResult(success=False, message=f"Hover failed: Element with ID '{element_id}' not found.", error_type=PlaywrightErrorType.ElementNotFound)
            await element.wait_for(state="visible", timeout=actual_timeout)
            await element.hover(timeout=actual_timeout)
            return ActionResult(success=True, message=f"Successfully hovered over element with ID: {element_id}.")
        except Exception as error:
            err_message = f"Failed to hover over element with ID '{element_id}' (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def clear_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element = self.page.locator(selector).first
            if await element.count() == 0:
                return ActionResult(success=False, message=f"Clear failed: Element with ID '{element_id}' not found.", error_type=PlaywrightErrorType.ElementNotFound)
            await element.wait_for(state="visible", timeout=actual_timeout)
            await element.fill("", timeout=actual_timeout) # fill with empty string to clear
            return ActionResult(success=True, message=f"Successfully cleared element with ID: {element_id}.")
        except Exception as error:
            err_message = f"Failed to clear element with ID '{element_id}' (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type)

    async def _get_element_type_from_locator(self, element_locator: Locator) -> str:
        explicit_type = await self._get_attribute(element_locator, DataAttributes.ELEMENT_TYPE)
        if explicit_type and explicit_type.strip():
            return explicit_type.strip().lower()

        tag_name = (await element_locator.evaluate("el => el.tagName")).lower()
        if tag_name == "input":
            type_attr = await self._get_attribute(element_locator, "type")
            return f"input-{type_attr or 'text'}".lower()
        return tag_name

    async def _get_element_label_from_locator(self, element_locator: Locator, element_id: str, element_type: str) -> str:
        label = await self._get_attribute(element_locator, "aria-label")
        if label and label.strip():
            return label.strip()

        mcp_label = await self._get_attribute(element_locator, DataAttributes.ELEMENT_LABEL)
        if mcp_label and mcp_label.strip():
            return mcp_label.strip()
        
        if not element_type.startswith("input"):
            text_content = await element_locator.text_content()
            label = text_content.strip() if text_content else None
            if label and label.strip(): # Check again after strip
                return label.strip()
        
        if element_type.startswith("input-") and element_type not in [
            "input-button", "input-submit", "input-reset", "input-checkbox", "input-radio"
        ]:
            label = await self._get_attribute(element_locator, "placeholder")
            if label and label.strip():
                return label.strip()
        
        return element_id

    async def get_element_state(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable, data=None)
        actual_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT
        selector = f'[{DataAttributes.INTERACTIVE_ELEMENT}="{element_id}"]'
        try:
            element_locator = self.page.locator(selector).first
            await element_locator.wait_for(state="attached", timeout=actual_timeout)

            if await element_locator.count() == 0:
                return ActionResult(success=False, message=f"Get element state failed: Element with ID '{element_id}' not found.", error_type=PlaywrightErrorType.ElementNotFound, data=None)

            element_type = await self._get_element_type_from_locator(element_locator)
            label = await self._get_element_label_from_locator(element_locator, element_id, element_type)

            current_value: Optional[str] = None
            is_checked: Optional[bool] = None
            is_disabled: Optional[bool] = None
            is_read_only: Optional[bool] = None

            current_value = await self._get_attribute(element_locator, DataAttributes.VALUE)
            
            mcp_disabled = await self._get_attribute(element_locator, DataAttributes.DISABLED_STATE)
            if mcp_disabled is not None:
                is_disabled = mcp_disabled == "true"
            else:
                is_disabled = await element_locator.is_disabled(timeout=actual_timeout)

            mcp_read_only = await self._get_attribute(element_locator, DataAttributes.READONLY_STATE)
            if mcp_read_only is not None:
                is_read_only = mcp_read_only == "true"
            else:
                if element_type.startswith("input-") or element_type in ["textarea", "select"]:
                    is_potentially_editable = await element_locator.is_editable(timeout=actual_timeout)
                    if is_disabled: # If disabled, it's not editable, but we care about explicit readonly
                        is_read_only = False 
                        actual_read_only_attr = await element_locator.evaluate("el => el.readOnly")
                        if actual_read_only_attr: is_read_only = True
                    else: # If not disabled, then !is_editable implies readonly
                        is_read_only = not is_potentially_editable
            
            # Get value for inputs/selects if not overridden by data-mcp-value
            if current_value is None and (element_type.startswith("input-") or element_type in ["textarea", "select"]):
                if element_type in ["input-checkbox", "input-radio"]:
                    is_checked = await element_locator.is_checked(timeout=actual_timeout)
                elif element_type not in ["input-button", "input-submit", "input-reset", "input-file"]:
                    try:
                        current_value = await element_locator.input_value(timeout=actual_timeout)
                    except Exception as e:
                        logger.warning(f"WARNING: Could not retrieve input_value for {element_id} (type: {element_type}) (async): {e}")
                        current_value = None
            
            state_data: Dict[str, Any] = { # Renamed from 'state' to avoid conflict
                "id": element_id,
                "elementType": element_type, # Changed from 'type' to avoid Pydantic conflict with built-in 'type'
                "label": label,
                "isDisabled": is_disabled,
                "isReadOnly": is_read_only,
            }
            # Update InteractiveElementInfo model if 'type' was intended field name.
            # For now, using 'elementType' in the dict passed to InteractiveElementInfo.

            if current_value is not None: state_data["currentValue"] = current_value
            if is_checked is not None: state_data["isChecked"] = is_checked
            
            # Get other data-mcp attributes
            for attr_key, data_attr_name in [
                ("purpose", DataAttributes.PURPOSE),
                ("group", DataAttributes.GROUP),
                ("controls", DataAttributes.CONTROLS),
                ("updatesContainer", DataAttributes.UPDATES_CONTAINER),
                ("navigatesTo", DataAttributes.NAVIGATES_TO),
                ("customState", DataAttributes.ELEMENT_STATE), # This was 'state' in TS; using 'customState' from attribute
            ]:
                attr_val = await self._get_attribute(element_locator, data_attr_name)
                if attr_val is not None:
                    state_data[attr_key] = attr_val
            
            # Handle custom attribute readers
            if self.custom_attribute_readers:
                state_data["customData"] = {}
                for reader in self.custom_attribute_readers:
                    raw_value = await self._get_attribute(element_locator, reader.attribute_name)
                    try:
                        if reader.process_value:
                            # Get ElementHandle for advanced processing (matching TypeScript feature parity)
                            element_handle = await element_locator.element_handle()
                            processed_value = reader.process_value(
                                raw_value if raw_value is not None else None,
                                element_handle
                            )
                            state_data["customData"][reader.output_key] = processed_value
                        elif raw_value is not None:
                            state_data["customData"][reader.output_key] = raw_value
                    except Exception as e:
                        logger.warning(f"WARNING: Error processing custom attribute \"{reader.attribute_name}\" for element \"{element_id}\" with key \"{reader.output_key}\" (async): {e}")
                        state_data["customData"][reader.output_key] = "ERROR_PROCESSING_ATTRIBUTE"

            message = f"Successfully retrieved state for element {element_id} (async)."
            # Create the Pydantic model from the collected state_data
            # Ensure InteractiveElementInfo fields match keys in state_data
            element_info_obj = InteractiveElementInfo(**state_data)
            return ActionResult(success=True, message=message, data=element_info_obj)

        except Exception as error:
            err_message = f"Error getting state for element with ID {element_id} (async)."
            error_type = PlaywrightErrorType.ActionFailed
            if "TimeoutError" in str(type(error)):
                error_type = PlaywrightErrorType.Timeout
                err_message = f"Timeout waiting for element '{element_id}' to be ready for state retrieval (async)."
            elif "not found" in str(error).lower(): # Basic check
                error_type = PlaywrightErrorType.ElementNotFound

            logger.error(f"ERROR: {err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Details: {str(error)}", error_type=error_type, data=None)

    async def scroll_page_down(self) -> ActionResult:
        if not self.page:
            message = "Scroll down failed: Page is not initialized."
            logger.error(message)
            return ActionResult(success=False, message=message, error_type=PlaywrightErrorType.PageNotAvailable)
        try:
            await self.page.evaluate("window.scrollBy(0, window.innerHeight)")
            message = "Successfully scrolled down the page."
            logger.info(message)
            return ActionResult(success=True, message=message)
        except Exception as error:
            err_message = "Failed to scroll down the page."
            logger.error(f"{err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Error: {str(error)}", error_type=PlaywrightErrorType.ActionFailed)

    async def scroll_page_up(self) -> ActionResult:
        if not self.page:
            message = "Scroll up failed: Page is not initialized."
            logger.error(message)
            return ActionResult(success=False, message=message, error_type=PlaywrightErrorType.PageNotAvailable)
        try:
            await self.page.evaluate("window.scrollBy(0, -window.innerHeight)")
            message = "Successfully scrolled up the page."
            logger.info(message)
            return ActionResult(success=True, message=message)
        except Exception as error:
            err_message = "Failed to scroll up the page."
            logger.error(f"{err_message} Details: {error}")
            return ActionResult(success=False, message=f"{err_message} Error: {str(error)}", error_type=PlaywrightErrorType.ActionFailed)

    async def get_elements_page(self, start_index: int = 0, page_size: int = 20) -> ActionResult:
        """Get a specific page of interactive elements."""
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable, data=None)
        
        from .dom_parser import DomParser
        dom_parser = DomParser(self.page, self.custom_attribute_readers)
        result = await dom_parser.get_interactive_elements_with_state(start_index, page_size)
        
        if result.success:
            return ActionResult(success=True, message=result.message, data=result.data)
        else:
            return ActionResult(
                success=False, 
                message=result.message, 
                error_type=result.error_type,
                data=None
            )

    async def get_next_elements_page(self, current_start_index: int, page_size: int = 20) -> ActionResult:
        """Get the next page of interactive elements."""
        next_start_index = current_start_index + page_size
        return await self.get_elements_page(next_start_index, page_size)

    async def get_previous_elements_page(self, current_start_index: int, page_size: int = 20) -> ActionResult:
        """Get the previous page of interactive elements."""
        prev_start_index = max(0, current_start_index - page_size)
        return await self.get_elements_page(prev_start_index, page_size)

    async def get_first_elements_page(self, page_size: int = 20) -> ActionResult:
        """Get the first page of interactive elements."""
        return await self.get_elements_page(0, page_size)

    async def get_structured_data_page(self, start_index: int = 0, page_size: int = 20) -> ActionResult:
        """Get a specific page of structured data."""
        if not self.page:
            return ActionResult(success=False, message="Page not initialized", error_type=PlaywrightErrorType.PageNotAvailable, data=None)
        
        from .dom_parser import DomParser
        dom_parser = DomParser(self.page, self.custom_attribute_readers)
        result = await dom_parser.get_structured_data(start_index, page_size)
        
        if result.success:
            return ActionResult(success=True, message=result.message, data=result.data)
        else:
            return ActionResult(
                success=False, 
                message=result.message, 
                error_type=result.error_type,
                data=None
            )

    async def get_next_structured_data_page(self, current_start_index: int, page_size: int = 20) -> ActionResult:
        """Get the next page of structured data."""
        next_start_index = current_start_index + page_size
        return await self.get_structured_data_page(next_start_index, page_size)

    async def get_previous_structured_data_page(self, current_start_index: int, page_size: int = 20) -> ActionResult:
        """Get the previous page of structured data."""
        prev_start_index = max(0, current_start_index - page_size)
        return await self.get_structured_data_page(prev_start_index, page_size)

    async def get_first_structured_data_page(self, page_size: int = 20) -> ActionResult:
        """Get the first page of structured data."""
        return await self.get_structured_data_page(0, page_size)

    pass


# --- Async Implementation of AutomationInterface for PlaywrightController --- 
class AsyncAutomationInterface(ModelAutomationInterface): # Inherit from the model's definition if it's an ABC or Protocol
    # This seems to be intended as an abstract base class or protocol for type hinting
    # It might define abstract methods
    async def click(self, element_id: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def type_text(self, element_id: str, text: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def select_option(self, element_id: str, value: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def check_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def uncheck_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def select_radio_button(self, radio_button_id_in_group: str, value_to_select: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def hover_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def clear_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult: ...
    async def get_element_state(self, element_id: str, timeout: Optional[int] = None) -> ActionResult[Optional[InteractiveElementInfo]]: ...
    pass


class AutomationInterfaceImpl: # No inheritance from AsyncAutomationInterface
    def __init__(self, playwright_controller: PlaywrightController):
        self._playwright_controller = playwright_controller

    async def click(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.click(element_id, timeout)

    async def type_text(self, element_id: str, text: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.type_text(element_id, text, timeout)

    async def select_option(self, element_id: str, value: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.select_option(element_id, value, timeout)

    async def check_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.check_element(element_id, timeout)

    async def uncheck_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.uncheck_element(element_id, timeout)

    async def select_radio_button(self, radio_button_id_in_group: str, value_to_select: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.select_radio_button(radio_button_id_in_group, value_to_select, timeout)

    async def hover_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.hover_element(element_id, timeout)

    async def clear_element(self, element_id: str, timeout: Optional[int] = None) -> ActionResult:
        return await self._playwright_controller.clear_element(element_id, timeout)

    async def get_element_state(self, element_id: str, timeout: Optional[int] = None) -> ActionResult[Optional[InteractiveElementInfo]]:
        # The Pydantic InteractiveElementInfo will be used for the data part of ActionResult
        action_result = await self._playwright_controller.get_element_state(element_id, timeout)
        # Validation to InteractiveElementInfo is now handled inside get_element_state of PlaywrightController
        return action_result 