import type { Locator, Page } from '@playwright/test';
import {
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '../../assertions/driver-expect';
import { ElementNotFoundError } from '../../core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import type {
  DriverNode,
  DriverWaitOptions,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '../../driver/driver';
import { isWaitTextCondition } from '../../driver/driver';
import { formatTestIdPath } from '../../selector/format';

export type PlaywrightDriverNodeHost = {
  readonly page: Page;
};

/** Locator node for {@link PlaywrightDriver} — chains Playwright locators. */
export class PlaywrightDriverNode implements DriverNode {
  readonly expect: DriverNode['expect'] = {
    visible: (options) => runExpectVisible(this, options),
    hidden: (options) => runExpectHidden(this, options),
    text: (expected, options) => runExpectText(this, expected, options),
  };

  constructor(
    private readonly host: PlaywrightDriverNodeHost,
    private readonly path: readonly string[],
    private readonly locator: Locator
  ) {}

  get(testId: string): DriverNode {
    return new PlaywrightDriverNode(
      this.host,
      [...this.path, testId],
      this.locator.getByTestId(testId)
    );
  }

  async tap(options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.locator.click();
  }

  async tapAt(position: TapPosition): Promise<void> {
    await this.waitVisible();
    const box = await this.locator.boundingBox();
    if (!box) {
      throw new ElementNotFoundError(
        formatTestIdPath(this.path),
        'no bounding box'
      );
    }
    await this.locator.click({
      position: {
        x: box.width * position.xRatio,
        y: box.height * position.yRatio,
      },
    });
  }

  async input(text: string, options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.locator.pressSequentially(text);
  }

  async clear(): Promise<void> {
    await this.locator.fill('');
  }

  async key(key: DriverKey): Promise<void> {
    await this.locator.press(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(direction: ScrollDirection, amount = 100): Promise<void> {
    const delta = scrollDelta(direction, amount);
    await this.locator.evaluate((node, d) => {
      node.scrollBy(d.x, d.y);
    }, delta);
  }

  async wait(
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    if (isWaitTextCondition(state)) {
      await this.waitText(state, options);
      return;
    }
    const waitState = state === 'visible' ? 'visible' : 'hidden';
    if (options?.timeoutMs !== undefined) {
      await this.locator.waitFor({
        state: waitState,
        timeout: options.timeoutMs,
      });
      return;
    }
    await this.locator.waitFor({ state: waitState });
  }

  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  async text(): Promise<string | null> {
    if ((await this.locator.count()) === 0) {
      throw new ElementNotFoundError(formatTestIdPath(this.path));
    }
    const inputValue = await this.locator.inputValue().catch(() => null);
    if (inputValue !== null) {
      return inputValue;
    }
    return this.locator.innerText();
  }

  private async waitText(
    state: WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    const exact = state.exact !== false;
    const filtered = exact
      ? this.locator.filter({
          hasText: new RegExp(`^${escapeRegex(state.text)}$`),
        })
      : this.locator.filter({ hasText: state.text });
    await filtered.waitFor({
      state: 'visible',
      ...(options?.timeoutMs !== undefined
        ? { timeout: options.timeoutMs }
        : {}),
    });
  }

  private async waitVisible(options?: UiWaitOptions): Promise<void> {
    await this.wait(
      'visible',
      options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : undefined
    );
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

export function createPlaywrightDriverNode(
  host: PlaywrightDriverNodeHost,
  testId: string
): PlaywrightDriverNode {
  return new PlaywrightDriverNode(
    host,
    [testId],
    host.page.getByTestId(testId)
  );
}
