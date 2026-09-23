// @io-wall-ok — host adapter polls with wall clock / timers (like waitUntil).
/**
 * Locator node for {@link BunWebviewDriver} — CSS `[data-testid]` chains.
 */

import { wallClock, wallTimers } from '@pkgs/clock';
import {
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '@pkgs/ui-testing/assertions/driver-expect';
import {
  ElementNotFoundError,
  TimeoutError,
} from '@pkgs/ui-testing/core/errors';
import { DRIVER_KEY_TO_DOM, type DriverKey } from '@pkgs/ui-testing/core/keys';
import { waitUntil } from '@pkgs/ui-testing/core/wait';
import type {
  DriverNode,
  DriverWaitOptions,
  ElementLayout,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing/driver/driver';
import { isWaitTextCondition } from '@pkgs/ui-testing/driver/driver';
import { formatTestIdPath } from '@pkgs/ui-testing/selector/format';
import type { BunWebviewHost } from './bun-webview-host';
import {
  dragScript,
  focusFieldScript,
  isVisibleScript,
  layoutScript,
  markTapTargetScript,
  obstructionScript,
  scrollScript,
  TAP_TARGET_ATTR,
  textScript,
  visibleTestIdsScript,
} from './page-scripts';

const DEFAULT_WAIT_MS = 5_000;
const TAP_ATTEMPT_MS = 1_000;

function cssPath(path: readonly string[]): string {
  return path.map((id) => `[data-testid=${JSON.stringify(id)}]`).join(' ');
}

export class BunWebviewDriverNode implements DriverNode {
  readonly expect: DriverNode['expect'] = {
    visible: (options) => runExpectVisible(this, options),
    hidden: (options) => runExpectHidden(this, options),
    text: (expected, options) => runExpectText(this, expected, options),
  };

  constructor(
    private readonly host: BunWebviewHost,
    private readonly path: readonly string[]
  ) {}

  get(testId: string): DriverNode {
    return new BunWebviewDriverNode(this.host, [...this.path, testId]);
  }

  /**
   * Native click on the resolved node. A re-render can swap the node out
   * between resolve and click (the native click then waits on a detached
   * target), so attempts are short and each one re-waits and re-resolves.
   */
  async tap(options?: UiWaitOptions): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_WAIT_MS;
    const deadline = wallClock.now() + timeoutMs;
    let lastError: unknown = null;
    for (;;) {
      const remaining = Math.max(deadline - wallClock.now(), 0);
      await this.waitVisible({ timeoutMs: remaining });
      const marked = await this.host.view.evaluate(
        markTapTargetScript(this.selector)
      );
      if (marked === true) {
        try {
          await this.host.view.click(`[${TAP_TARGET_ATTR}]`, {
            timeout: Math.max(Math.min(TAP_ATTEMPT_MS, remaining), 1),
          });
          return;
        } catch (err) {
          lastError = err;
        }
      }
      if (wallClock.now() >= deadline) {
        throw await this.tapError(lastError, timeoutMs);
      }
    }
  }

  async tapAt(position: TapPosition): Promise<void> {
    await this.waitVisible();
    const box = await this.requireBox();
    await this.host.view.click(
      box.x + box.width * position.xRatio,
      box.y + box.height * position.yRatio
    );
  }

  async drag(from: TapPosition, to: TapPosition): Promise<void> {
    await this.waitVisible();
    const box = await this.requireBox();
    await this.host.view.evaluate(
      dragScript(
        this.selector,
        {
          x: box.x + box.width * from.xRatio,
          y: box.y + box.height * from.yRatio,
        },
        {
          x: box.x + box.width * to.xRatio,
          y: box.y + box.height * to.yRatio,
        }
      )
    );
  }

  async layout(): Promise<ElementLayout | null> {
    const box = await this.host.view.evaluate(layoutScript(this.selector));
    if (box === null || typeof box !== 'object') return null;
    return box as ElementLayout;
  }

  async input(text: string, options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.focusField('end');
    await this.host.view.type(text);
  }

  async clear(): Promise<void> {
    await this.focusField('select');
    await this.host.view.press('Backspace');
  }

  async key(key: DriverKey): Promise<void> {
    await this.host.view.press(DRIVER_KEY_TO_DOM[key]);
  }

  async scroll(direction: ScrollDirection, amount = 100): Promise<void> {
    const delta = scrollDelta(direction, amount);
    await this.host.view.evaluate(
      scrollScript(this.selector, delta.x, delta.y)
    );
  }

  async wait(
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_WAIT_MS;
    const description =
      options?.description ??
      `${formatTestIdPath(this.path)} wait ${JSON.stringify(state)}`;
    try {
      await waitUntil(
        async () => {
          if (isWaitTextCondition(state)) {
            const text = await this.text().catch(() => null);
            if (text === null) return false;
            return state.exact === false
              ? text.includes(state.text)
              : text === state.text;
          }
          const visible = await this.isVisible();
          return state === 'visible' ? visible : !visible;
        },
        {
          timeoutMs,
          description,
          now: wallClock.now,
          timers: wallTimers,
        }
      );
    } catch (err) {
      const onScreen = await this.visibleTestIds();
      const context = `${description} (visible: ${onScreen})`;
      throw new TimeoutError(context, timeoutMs, {
        cause: err instanceof TimeoutError ? err.cause : err,
      });
    }
  }

  async isVisible(): Promise<boolean> {
    return (
      (await this.host.view.evaluate(isVisibleScript(this.selector))) === true
    );
  }

  async text(): Promise<string | null> {
    const result = await this.host.view.evaluate(textScript(this.selector));
    if (result === null || typeof result !== 'object') {
      throw new ElementNotFoundError(formatTestIdPath(this.path));
    }
    const value = (result as { readonly text?: unknown }).text;
    return typeof value === 'string' ? value : null;
  }

  private async tapError(cause: unknown, timeoutMs: number): Promise<Error> {
    const covered = await this.host.view
      .evaluate(obstructionScript(this.selector))
      .catch(() => 'n/a');
    const blocker =
      typeof covered === 'string' ? `covered by ${covered}` : 'not stable';
    return new TimeoutError(
      `${formatTestIdPath(this.path)} tap: not clickable, ${blocker} (visible: ${await this.visibleTestIds()})`,
      timeoutMs,
      { cause }
    );
  }

  private async visibleTestIds(): Promise<string> {
    try {
      const ids = await this.host.view.evaluate(visibleTestIdsScript());
      return Array.isArray(ids) ? ids.slice(0, 40).join(', ') : 'n/a';
    } catch {
      return 'n/a';
    }
  }

  private get selector(): string {
    return cssPath(this.path);
  }

  private async focusField(caret: 'end' | 'select'): Promise<void> {
    const focused = await this.host.view.evaluate(
      focusFieldScript(this.selector, caret)
    );
    if (focused !== true) {
      throw new ElementNotFoundError(
        formatTestIdPath(this.path),
        'no <input> / <textarea> under matched element'
      );
    }
  }

  private async waitVisible(options?: UiWaitOptions): Promise<void> {
    await this.wait(
      'visible',
      options?.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : undefined
    );
  }

  private async requireBox(): Promise<ElementLayout> {
    const box = await this.layout();
    if (box === null) {
      throw new ElementNotFoundError(
        formatTestIdPath(this.path),
        'no bounding box'
      );
    }
    return box;
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
