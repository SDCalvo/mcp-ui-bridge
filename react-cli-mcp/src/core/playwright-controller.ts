import { chromium, Browser, Page, BrowserContext } from "playwright";

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(
    private launchOptions: { headless?: boolean } = { headless: true }
  ) {}

  async launch(): Promise<void> {
    if (this.browser) {
      console.warn("Browser already launched.");
      return;
    }
    this.browser = await chromium.launch(this.launchOptions);
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    console.log("Browser launched and page created.");
  }

  async navigate(
    url: string,
    options?: {
      waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
    }
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page is not initialized. Call launch() first.");
    }
    console.log(`Navigating to ${url}...`);
    await this.page.goto(url, options);
    console.log("Navigation successful.");
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Page is not initialized. Call launch() first.");
    }
    return this.page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log("Browser closed.");
    } else {
      console.warn("Browser not launched or already closed.");
    }
  }
}
