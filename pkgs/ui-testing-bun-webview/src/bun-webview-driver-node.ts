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

  async tap(options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    await this.host.view.click(cssPath(this.path));
  }

  async tapAt(position: TapPosition): Promise<void> {
    await this.waitVisible();
    const box = await this.requireBox();
    const x = box.x + box.width * position.xRatio;
    const y = box.y + box.height * position.yRatio;
    await this.host.view.evaluate(
      `(function(){ const el = document.elementFromPoint(${x}, ${y}); el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: ${x}, clientY: ${y} })); })()`
    );
  }

  async drag(from: TapPosition, to: TapPosition): Promise<void> {
    await this.waitVisible();
    const box = await this.requireBox();
    const sx = box.x + box.width * from.xRatio;
    const sy = box.y + box.height * from.yRatio;
    const ex = box.x + box.width * to.xRatio;
    const ey = box.y + box.height * to.yRatio;
    await this.host.view.evaluate(
      `(function(){
        const t = document.elementFromPoint(${sx}, ${sy});
        if (!t) return;
        t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ${sx}, clientY: ${sy} }));
        t.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${ex}, clientY: ${ey} }));
        t.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: ${ex}, clientY: ${ey} }));
      })()`
    );
  }

  async layout(): Promise<ElementLayout | null> {
    const box = await this.host.view.evaluate(
      `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`
    );
    if (box === null || typeof box !== 'object') return null;
    return box as ElementLayout;
  }

  async input(text: string, options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    const sel = JSON.stringify(cssPath(this.path));
    const value = JSON.stringify(text);
    await this.host.view.evaluate(
      `(function(){ const el = document.querySelector(${sel}); if (!el) return; el.focus(); if ('value' in el) { el.value = ${value}; el.dispatchEvent(new Event('input', { bubbles: true })); } })()`
    );
  }

  async clear(): Promise<void> {
    const sel = JSON.stringify(cssPath(this.path));
    await this.host.view.evaluate(
      `(function(){ const el = document.querySelector(${sel}); if (!el) return; if ('value' in el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); } })()`
    );
  }

  async key(key: DriverKey): Promise<void> {
    const domKey = DRIVER_KEY_TO_DOM[key];
    const sel = JSON.stringify(cssPath(this.path));
    await this.host.view.evaluate(
      `(function(){ const el = document.querySelector(${sel}); el?.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(domKey)}, bubbles: true })); })()`
    );
  }

  async scroll(direction: ScrollDirection, amount = 100): Promise<void> {
    const delta = scrollDelta(direction, amount);
    const sel = JSON.stringify(cssPath(this.path));
    await this.host.view.evaluate(
      `(function(){ const el = document.querySelector(${sel}); el?.scrollBy(${delta.x}, ${delta.y}); })()`
    );
  }

  async wait(
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 5_000;
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
              : text.trim() === state.text;
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
      if (err instanceof TimeoutError) throw err;
      throw new TimeoutError(description, timeoutMs, { cause: err });
    }
  }

  async isVisible(): Promise<boolean> {
    const result = await this.host.view.evaluate(
      `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); if (!el) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; })()`
    );
    return result === true;
  }

  async text(): Promise<string | null> {
    const result = await this.host.view.evaluate(
      `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); if (!el) return null; if ('value' in el && typeof el.value === 'string') return el.value; return el.innerText ?? el.textContent; })()`
    );
    if (result === null) {
      throw new ElementNotFoundError(formatTestIdPath(this.path));
    }
    return typeof result === 'string' ? result : String(result);
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
