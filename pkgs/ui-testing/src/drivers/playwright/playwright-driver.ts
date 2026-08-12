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
  WaitState,
} from '../../driver/driver';
import { formatSelector } from '../../selector/format';
import type { Selector } from '../../selector/selector';

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

  async tap(target: Selector): Promise<void> {
    await this.locator(target).click();
  }

  async tapAt(target: Selector, position: TapPosition): Promise<void> {
    const loc = this.locator(target);
    const box = await loc.boundingBox();
    if (!box) {
      throw new ElementNotFoundError(formatSelector(target), 'no bounding box');
    }
    await loc.click({
      position: {
        x: box.width * position.xRatio,
        y: box.height * position.yRatio,
      },
    });
  }

  async input(target: Selector, text: string): Promise<void> {
    await this.locator(target).pressSequentially(text);
  }

  async clear(target: Selector): Promise<void> {
    await this.locator(target).fill('');
  }

  async key(key: DriverKey): Promise<void> {
    await this.page.keyboard.press(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(
    target: Selector,
    direction: ScrollDirection,
    amount = 100
  ): Promise<void> {
    const delta = scrollDelta(direction, amount);
    await this.locator(target).evaluate((node, d) => {
      node.scrollBy(d.x, d.y);
    }, delta);
  }

  async back(): Promise<void> {
    await this.page.goBack();
  }

  async wait(
    target: Selector,
    state: WaitState,
    options?: WaitPollOptions
  ): Promise<void> {
    const waitState = state === 'visible' ? 'visible' : 'hidden';
    if (options?.timeoutMs !== undefined) {
      await this.locator(target).waitFor({
        state: waitState,
        timeout: options.timeoutMs,
      });
      return;
    }
    await this.locator(target).waitFor({ state: waitState });
  }

  async expectVisible(
    target: Selector,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectVisible(this, target, options);
  }

  async expectHidden(
    target: Selector,
    options?: AssertionOptions
  ): Promise<void> {
    await runExpectHidden(this, target, options);
  }

  async expectText(
    target: Selector,
    expected: string,
    options?: AssertionOptions & { exact?: boolean }
  ): Promise<void> {
    await runExpectText(this, target, expected, options);
  }

  async isVisible(target: Selector): Promise<boolean> {
    return this.locator(target).isVisible();
  }

  async getText(target: Selector): Promise<string | null> {
    const loc = this.locator(target);
    if ((await loc.count()) === 0) {
      throw new ElementNotFoundError(formatSelector(target));
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

  private locator(target: Selector): Locator {
    return toLocator(this.page, target);
  }
}

function toLocator(page: Page, selector: Selector): Locator {
  const base = baseLocator(page, selector);
  if (selector.nth !== undefined) {
    return base.nth(selector.nth);
  }
  return base;
}

function baseLocator(page: Page, selector: Selector): Locator {
  switch (selector.kind) {
    case 'testId':
      return page.getByTestId(selector.value);
    case 'text':
      return page.getByText(selector.value, {
        exact: selector.exact !== false,
      });
    case 'label':
      return page.getByLabel(selector.value);
    case 'role':
      return selector.name !== undefined
        ? page.getByRole(selector.role, { name: selector.name })
        : page.getByRole(selector.role);
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
