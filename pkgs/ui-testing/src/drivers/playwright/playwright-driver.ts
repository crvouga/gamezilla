import type { Page } from '@playwright/test';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import type { Driver, DriverNode } from '../../driver/driver';
import {
  createPlaywrightDriverNode,
  type PlaywrightDriverNodeHost,
} from './playwright-driver-node';

export type PlaywrightDriverOptions = {
  /** Injected Playwright {@link Page} — the framework never launches a browser. */
  page: Page;
  /** Optional URL to open on `launch()`. Omit when the page is already loaded. */
  baseUrl?: string;
};

/**
 * Driver over an injected Playwright {@link Page}.
 * Waits use Playwright's event-driven `waitFor` / `waitForFunction` — no
 * shared poll interval.
 */
export class PlaywrightDriver implements Driver, PlaywrightDriverNodeHost {
  readonly kind = 'playwright';

  readonly page: Page;
  private readonly baseUrl: string | undefined;

  constructor(options: PlaywrightDriverOptions) {
    this.page = options.page;
    this.baseUrl = options.baseUrl;
  }

  async launch(): Promise<void> {
    if (this.baseUrl) {
      await this.page.goto(this.baseUrl);
    }
  }

  async close(): Promise<void> {
    // Page lifecycle is owned by the consumer (fixture / browser context).
  }

  get(testId: string): DriverNode {
    return createPlaywrightDriverNode(this, testId);
  }

  async key(key: DriverKey): Promise<void> {
    await this.page.keyboard.press(DRIVER_KEY_TO_DOM[key]);
  }

  async snapshotHtml(): Promise<string | null> {
    return this.page.content();
  }
}
