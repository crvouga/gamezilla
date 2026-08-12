import type { Locator, Page } from '@playwright/test';
import {
  type AssertionOptions,
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '../../assertions/driver-expect';
import { ElementNotFoundError } from '../../core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import type { WaitPollOptions } from '../../core/wait';
import type {
  Driver,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
} from '../../driver/driver';
import { formatTestId } from '../../selector/format';

export type PlaywrightDriverOptions = {
  /** Injected Playwright page — the framework never launches a browser. */
  page: Page;
  /** Optional URL to open on `launch()`. Omit when the page is already loaded. */
  baseUrl?: string;
};

/**
 * Driver over an injected Playwright {@link Page}.
 * `@playwright/test` is a type-only dependency of this package.
 */
export class PlaywrightDriver implements Driver {
  readonly kind = 'playwright';

  private readonly page: Page;
  private readonly baseUrl: string | undefined;

  readonly expect: Driver['expect'] = {
    visible: (testId, options) => this.expectVisible(testId, options),
    hidden: (testId, options) => this.expectHidden(testId, options),
    text: (testId, expected, options) =>
      this.expectText(testId, expected, options),
  };

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

  async tap(testId: string, options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(testId, options);
    await this.locator(testId).click();
  }

  async tapAt(testId: string, position: TapPosition): Promise<void> {
    await this.waitVisible(testId);
    const loc = this.locator(testId);
    const box = await loc.boundingBox();
    if (!box) {
      throw new ElementNotFoundError(formatTestId(testId), 'no bounding box');
    }
    await loc.click({
      position: {
        x: box.width * position.xRatio,
        y: box.height * position.yRatio,
      },
    });
  }

  async input(
    testId: string,
    text: string,
    options?: UiWaitOptions
  ): Promise<void> {
    await this.waitVisible(testId, options);
    await this.locator(testId).pressSequentially(text);
  }

  async clear(testId: string): Promise<void> {
    await this.locator(testId).fill('');
  }

  async key(key: DriverKey): Promise<void> {
    await this.page.keyboard.press(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(
    testId: string,
    direction: ScrollDirection,
    amount = 100
  ): Promise<void> {
    const delta = scrollDelta(direction, amount);
    await this.locator(testId).evaluate((node, d) => {
      node.scrollBy(d.x, d.y);
    }, delta);
  }

  async wait(
    testId: string,
    state: WaitState,
    options?: WaitPollOptions
  ): Promise<void> {
    const waitState = state === 'visible' ? 'visible' : 'hidden';
    if (options?.timeoutMs !== undefined) {
      await this.locator(testId).waitFor({
        state: waitState,
        timeout: options.timeoutMs,
      });
      return;
    }
    await this.locator(testId).waitFor({ state: waitState });
  }

  async isVisible(testId: string): Promise<boolean> {
    return this.locator(testId).isVisible();
  }

  async getText(testId: string): Promise<string | null> {
    const loc = this.locator(testId);
    if ((await loc.count()) === 0) {
      throw new ElementNotFoundError(formatTestId(testId));
    }
    const inputValue = await loc.inputValue().catch(() => null);
    if (inputValue !== null) {
      return inputValue;
    }
    return loc.innerText();
  }

  async snapshotHtml(): Promise<string | null> {
    return this.page.content();
  }

  private async expectVisible(
    testId: string,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectVisible(this, testId, options);
  }

  private async expectHidden(
    testId: string,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectHidden(this, testId, options);
  }

  private async expectText(
    testId: string,
    expected: string,
    options?: AssertionOptions & { exact?: boolean }
  ): Promise<void> {
    await runExpectText(this, testId, expected, options);
  }

  private async waitVisible(
    testId: string,
    options?: UiWaitOptions
  ): Promise<void> {
    await this.wait(
      testId,
      'visible',
      options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : undefined
    );
  }

  private locator(testId: string): Locator {
    return this.page.getByTestId(testId);
  }
}

function scrollDelta(
  direction: ScrollDirection,
  amount: number
): { x: number; y: number } {
  switch (direction) {
    case 'down':
      return { x: 0, y: amount };
    case 'up':
      return { x: 0, y: -amount };
    case 'right':
      return { x: amount, y: 0 };
    case 'left':
      return { x: -amount, y: 0 };
  }
}
