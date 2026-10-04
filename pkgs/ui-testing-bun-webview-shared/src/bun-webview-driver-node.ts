// @io-wall-ok — host adapter polls with wall clock / timers (like waitUntil).
/**
 * Locator node for {@link BunWebviewDriver} — CSS `[data-testid]` chains.
 */

import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import {
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '@pkgs/ui-testing-shared/driver-expect';
import { ElementNotFoundError } from '@pkgs/ui-testing-shared/element-not-found-error';
import { TimeoutError } from '@pkgs/ui-testing-shared/timeout-error';
import { UiTestError } from '@pkgs/ui-testing-shared/ui-test-error';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-shared/keys';
import type { DriverKey } from '@pkgs/ui-testing-shared/keys';
import { waitUntil } from '@pkgs/ui-testing-shared/wait';
import type {
  DriverNode,
  DriverWaitOptions,
  ElementLayout,
  GestureOptions,
  PointerButton,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing-shared/driver';
import { isWaitTextCondition } from '@pkgs/ui-testing-shared/driver';
import { formatTestIdPath } from '@pkgs/ui-testing-shared/format';
import type { BunWebView, BunWebviewHost } from './bun-webview-host';

/**
 * Page-side predicate: `el` is an `<input>` / `<textarea>`. Not `'value' in
 * el` — every `<button>` has a `value` too (`""` unless set).
 */
const IS_TEXT_FIELD = `(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)`;

/**
 * Page-side function: the text a person sees in `node`. Skips the branches
 * the Solid DOM driver's `collectVisibleText` skips (`hidden`, `inert`,
 * `aria-hidden="true"`, `display:none`, `visibility:hidden`), so a button's
 * width-lock spacer does not read as part of its label ("Save Saved").
 * Blocks and `<br>` separate words, as `innerText` does.
 */
const VISIBLE_TEXT = `function visibleText(node) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) { out += child.nodeValue; continue; }
    if (child.nodeType !== 1) continue;
    if (child.hasAttribute('hidden') || child.hasAttribute('inert') || child.getAttribute('aria-hidden') === 'true') continue;
    if (child.tagName === 'BR') { out += ' '; continue; }
    const style = getComputedStyle(child);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const inline = style.display.startsWith('inline') || style.display === 'contents';
    out += inline ? visibleText(child) : ' ' + visibleText(child) + ' ';
  }
  return out;
}`;

/**
 * Page-side expression for the text field under selector `sel`: the matched
 * node when it is one, else its first `<input>` / `<textarea>` — a
 * design-system `TextInput` puts its test id on the wrapper, like the Solid
 * DOM driver's `findTextField`.
 */
function textFieldExpr(sel: string): string {
  return `(function(){ const el = document.querySelector(${sel}); if (!el) return null; return ${IS_TEXT_FIELD} ? el : el.querySelector('input, textarea'); })()`;
}

/** Page-side counters of trusted `pointerdown`s / `pointerup`s (installed once per document). */
const ARM_POINTER_COUNTER = `(function () {
  if (window.__uiTestingPointerCounts === undefined) {
    var counts = { down: 0, up: 0 };
    window.__uiTestingPointerCounts = counts;
    document.addEventListener('pointerdown', function (e) {
      if (e.isTrusted) counts.down += 1;
    }, true);
    document.addEventListener('pointerup', function (e) {
      if (e.isTrusted) counts.up += 1;
    }, true);
  }
  return [window.__uiTestingPointerCounts.down, window.__uiTestingPointerCounts.up];
})()`;

/** Pause between re-sends, page-side so the host process stays unscheduled. */
const RESEND_PAUSE =
  'new Promise(function (resolve) { setTimeout(resolve, 50); })';

/** ~10s of re-sends: long enough to outlast a physical press elsewhere. */
const NATIVE_CLICK_ATTEMPTS = 200;

type PointerCounts = { readonly down: number; readonly up: number };

async function readPointerCounts(view: BunWebView): Promise<PointerCounts> {
  const raw = await view.evaluate(ARM_POINTER_COUNTER);
  if (
    !Array.isArray(raw) ||
    typeof raw[0] !== 'number' ||
    typeof raw[1] !== 'number'
  ) {
    throw new UiTestError('Bun.WebView: pointer counter returned no counts');
  }
  return { down: raw[0], up: raw[1] };
}

/**
 * `Bun.WebView.click(x, y)` synthesizes a non-automation `NSEvent` pair, so
 * WebKit reads `buttons` from the *system-wide* `[NSEvent pressedMouseButtons]`.
 * While a real mouse button is held anywhere on the machine, the synthetic
 * `mouseup` carries `buttons > 0` and WebKit turns its `pointerup` into a
 * `pointermove` (chorded press); the pointer then stays "pressed", so later
 * presses fire no `pointerdown` either. Only trusted `mousedown` / `mouseup` /
 * `click` reach the page.
 *
 * A person's tap is a full `pointerdown` → `pointerup`, so re-send until the
 * page has seen both: once the physical button is released, a re-send's
 * `pointerup` completes a press that already went down (or clears the stale
 * pressed state so the next re-send lands whole). A secondary press opens the
 * context menu, which swallows its `mouseup` on macOS, so only its
 * `pointerdown` is awaited.
 */
async function nativeClick(
  view: BunWebView,
  point: { readonly x: number; readonly y: number },
  button: PointerButton = 'primary'
): Promise<void> {
  const { x, y } = point;
  const awaitsRelease = button !== 'secondary';
  let pressed = false;
  for (let attempt = 1; attempt <= NATIVE_CLICK_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await view.evaluate(RESEND_PAUSE);
    const before = await readPointerCounts(view);
    await view.click(x, y, {
      button: button === 'secondary' ? 'right' : 'left',
    });
    const after = await readPointerCounts(view);
    pressed ||= after.down > before.down;
    if (pressed && (!awaitsRelease || after.up > before.up)) return;
  }
  throw new UiTestError(
    `Bun.WebView: native click at (${x}, ${y}) never delivered a whole press after ${NATIVE_CLICK_ATTEMPTS} attempts`
  );
}

/**
 * Page-side drag: `pointerdown` on the element under `start`, `pointermove`
 * to `mid` and `end`, `pointerup` at `end`; each with its compat mouse event.
 * A secondary drag also opens the context menu on press (macOS / Linux).
 */
const DISPATCH_DRAG = `function (pts) {
  var target = document.elementFromPoint(pts.start.x, pts.start.y);
  if (!target) return;
  var pressed = pts.secondary ? 2 : 0;
  var held = pts.secondary ? 2 : 1;
  function fire(type, mouseType, p, button, buttons) {
    var init = {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: button, buttons: buttons,
      clientX: p.x, clientY: p.y, screenX: p.x, screenY: p.y
    };
    target.dispatchEvent(new PointerEvent(type, init));
    target.dispatchEvent(new MouseEvent(mouseType, init));
  }
  fire('pointerdown', 'mousedown', pts.start, pressed, held);
  if (pts.secondary) {
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, button: 2, buttons: 2,
      clientX: pts.start.x, clientY: pts.start.y
    }));
  }
  fire('pointermove', 'mousemove', pts.mid, -1, held);
  fire('pointermove', 'mousemove', pts.end, -1, held);
  fire('pointerup', 'mouseup', pts.end, pressed, 0);
}`;

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
    const view = await this.view();
    const point = await view.evaluate(pressablePointScript(cssPath(this.path)));
    if (isPoint(point)) {
      await view.click(point.x, point.y);
      return;
    }
    // Nothing pressable yet: the selector click waits for actionability and
    // reports what blocks it.
    await view.click(cssPath(this.path));
  }

  async tapAt(position: TapPosition, options?: GestureOptions): Promise<void> {
    await this.waitVisible();
    await this.scrollIntoView();
    const box = await this.requireBox();
    const x = box.x + box.width * position.xRatio;
    const y = box.y + box.height * position.yRatio;
    // Native click: trusted pointerdown / mousedown / pointerup / mouseup /
    // click at the point, exactly what a person's tap delivers.
    await nativeClick(await this.view(), { x, y }, options?.button);
  }

  /**
   * Press at `from`, move through the midpoint, release at `to`: the same
   * PointerEvent (+ compat mouse) stream as the Solid DOM driver, dispatched
   * on the element under each point. `Bun.WebView` has no native drag.
   */
  async drag(
    from: TapPosition,
    to: TapPosition,
    options?: GestureOptions
  ): Promise<void> {
    await this.waitVisible();
    await this.scrollIntoView();
    const box = await this.requireBox();
    const point = (p: TapPosition) => ({
      x: box.x + box.width * p.xRatio,
      y: box.y + box.height * p.yRatio,
    });
    const start = point(from);
    const end = point(to);
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const secondary = options?.button === 'secondary';
    await (await this.view()).evaluate(
      `(${DISPATCH_DRAG})(${JSON.stringify({ start, mid, end, secondary })})`
    );
  }

  async layout(): Promise<ElementLayout | null> {
    const box = await (await this.view()).evaluate(
      `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`
    );
    if (box === null || typeof box !== 'object') return null;
    return box as ElementLayout;
  }

  async input(text: string, options?: UiWaitOptions): Promise<void> {
    await this.waitVisible(options);
    const sel = JSON.stringify(cssPath(this.path));
    const value = JSON.stringify(text);
    await (await this.view()).evaluate(
      `(function(){ const el = ${textFieldExpr(sel)}; if (!el) return; el.focus(); el.value = el.value + ${value}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`
    );
  }

  async clear(): Promise<void> {
    const sel = JSON.stringify(cssPath(this.path));
    await (await this.view()).evaluate(
      `(function(){ const el = ${textFieldExpr(sel)}; if (!el) return; el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); })()`
    );
  }

  async key(key: DriverKey): Promise<void> {
    const domKey = DRIVER_KEY_TO_DOM[key];
    const sel = JSON.stringify(cssPath(this.path));
    // Focus moves into the node first (unless already inside), then the key
    // goes to whatever holds focus — as when a person clicks, then types.
    await (await this.view()).evaluate(
      `(function(){
        const el = document.querySelector(${sel});
        if (!el) return;
        if (!el.contains(document.activeElement)) el.focus();
        const target = el.contains(document.activeElement) ? document.activeElement : el;
        const init = { key: ${JSON.stringify(domKey)}, bubbles: true, cancelable: true };
        target.dispatchEvent(new KeyboardEvent('keydown', init));
        target.dispatchEvent(new KeyboardEvent('keyup', init));
      })()`
    );
  }

  async scroll(direction: ScrollDirection, amount = 100): Promise<void> {
    const delta = scrollDelta(direction, amount);
    const sel = JSON.stringify(cssPath(this.path));
    await (await this.view()).evaluate(
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
    const result = await (await this.view()).evaluate(
      `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); if (!el) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; })()`
    );
    return result === true;
  }

  async text(): Promise<string | null> {
    const result = await (await this.view()).evaluate(
      `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); if (!el) return null; if (${IS_TEXT_FIELD}) return el.value; const fields = el.querySelectorAll('input, textarea'); if (fields.length === 1) return fields[0].value; const shown = (${VISIBLE_TEXT})(el).replace(/\\s+/g, ' ').trim(); if (shown.length > 0) return shown; return el.getAttribute('aria-label') || ''; })()`
    );
    if (result === null) {
      throw new ElementNotFoundError(formatTestIdPath(this.path));
    }
    return typeof result === 'string' ? result : String(result);
  }

  private async view() {
    return await this.host.resolveView(cssPath(this.path));
  }

  private async scrollIntoView(): Promise<void> {
    const selector = JSON.stringify(cssPath(this.path));
    await (await this.view()).evaluate(
      `(function(){ document.querySelector(${selector})?.scrollIntoView({ block: 'center', inline: 'center' }); })()`
    );
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

/**
 * The match a person could press: shown, scrolled into view, and on top at
 * its centre. Stacked screens keep earlier screens mounted underneath, so the
 * first match in document order is often covered.
 */
function pressablePointScript(selector: string): string {
  return `(function(){
    var all = document.querySelectorAll(${JSON.stringify(selector)});
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      var x = r.left + r.width / 2;
      var y = r.top + r.height / 2;
      var hit = document.elementFromPoint(x, y);
      if (hit !== null && (hit === el || el.contains(hit))) return { x: x, y: y };
    }
    return null;
  })()`;
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'x') === 'number' &&
    typeof Reflect.get(value, 'y') === 'number'
  );
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
