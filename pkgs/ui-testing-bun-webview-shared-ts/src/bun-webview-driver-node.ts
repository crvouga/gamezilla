// @io-wall-ok — host adapter polls with wall clock / timers (like waitUntil).
/**
 * Locator node for {@link BunWebviewDriver} — CSS `[data-testid]` chains.
 */

import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { controlIsEnabled } from '@pkgs/ui-testing-root-shared-ts/control-is-enabled';
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
} from '@pkgs/ui-testing-root-shared-ts/driver';
import { isWaitTextCondition } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  runExpectHidden,
  runExpectText,
  runExpectVisible,
} from '@pkgs/ui-testing-root-shared-ts/driver-expect';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';
import { formatTestIdPath } from '@pkgs/ui-testing-root-shared-ts/format';
import type { DriverKey } from '@pkgs/ui-testing-root-shared-ts/keys';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-root-shared-ts/keys';
import { TimeoutError } from '@pkgs/ui-testing-root-shared-ts/timeout-error';
import { UiTestError } from '@pkgs/ui-testing-root-shared-ts/ui-test-error';
import { waitUntil } from '@pkgs/ui-testing-root-shared-ts/wait';
import { pressBrowserKey } from './browser-key';
import type { BunWebView, BunWebviewHost } from './bun-webview-host';
import { diagnosePress } from './press-diagnosis';
import { visibilityScript } from './visibility-script';

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
    var counts = { down: 0, up: 0, click: 0 };
    window.__uiTestingPointerCounts = counts;
    document.addEventListener('pointerdown', function (e) {
      if (e.isTrusted) counts.down += 1;
    }, true);
    document.addEventListener('pointerup', function (e) {
      if (e.isTrusted) counts.up += 1;
    }, true);
    document.addEventListener('click', function (e) {
      if (e.isTrusted) counts.click += 1;
    }, true);
  }
  return [window.__uiTestingPointerCounts.down, window.__uiTestingPointerCounts.up, window.__uiTestingPointerCounts.click, performance.timeOrigin];
})()`;

/** Pause between re-sends, page-side so the host process stays unscheduled. */
const RESEND_PAUSE =
  'new Promise(function (resolve) { setTimeout(resolve, 50); })';

/** ~10s of re-sends: long enough to outlast a physical press elsewhere. */
const NATIVE_CLICK_ATTEMPTS = 200;

type PointerCounts = {
  readonly down: number;
  readonly up: number;
  readonly click: number;
  readonly documentId: number;
};

async function readPointerCounts(view: BunWebView): Promise<PointerCounts> {
  const raw = await view.evaluate(ARM_POINTER_COUNTER);
  if (
    !Array.isArray(raw) ||
    typeof raw[0] !== 'number' ||
    typeof raw[1] !== 'number'
  ) {
    throw new UiTestError('Bun.WebView: pointer counter returned no counts');
  }
  return {
    down: raw[0],
    up: raw[1],
    click: typeof raw[2] === 'number' ? raw[2] : 0,
    documentId: typeof raw[3] === 'number' ? raw[3] : 0,
  };
}

function clickProgress(
  completion: 'pointer' | 'click',
  counts: PointerCounts,
  initial: PointerCounts
): 'delivered' | 'pending' | 'send' {
  if (completion !== 'click') return 'send';
  if (counts.documentId !== initial.documentId || counts.click > initial.click)
    return 'delivered';
  return counts.down > initial.down && counts.up > initial.up
    ? 'pending'
    : 'send';
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
  target: string | { readonly x: number; readonly y: number },
  button: PointerButton = 'primary',
  completion: 'pointer' | 'click' = 'pointer'
): Promise<void> {
  const awaitsRelease = button !== 'secondary';
  let pressed = false;
  let initial: PointerCounts | null = null;
  for (let attempt = 1; attempt <= NATIVE_CLICK_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await view.evaluate(RESEND_PAUSE);
    const before = await readPointerCounts(view);
    initial ??= before;
    const progress = clickProgress(completion, before, initial);
    if (progress === 'delivered') return;
    // A complete press may still have its click queued in the page event loop.
    if (progress === 'pending') continue;
    if (typeof target === 'string') await view.click(target);
    else
      await view.click(target.x, target.y, {
        button: button === 'secondary' ? 'right' : 'left',
      });
    const after = await readPointerCounts(view);
    // A form navigation replaces the counters; the old click has already landed.
    if (after.documentId !== before.documentId) return;
    if (completion === 'click') {
      if (after.click > initial.click) return;
      continue;
    }
    pressed ||= after.down > before.down;
    if (pressed && (!awaitsRelease || after.up > before.up)) return;
  }
  throw new UiTestError(
    `Bun.WebView: native click at ${JSON.stringify(target)} never delivered a whole press after ${NATIVE_CLICK_ATTEMPTS} attempts`
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
    const target = await view.evaluate(
      pressableTargetScript(cssPath(this.path))
    );
    if (typeof target === 'string') {
      // A trusted click can arrive even when WebKit suppresses pointerup
      // during a physical chord. Repeating that delivered button click
      // would activate a menu twice; coordinate gestures still await pointers.
      try {
        // Keep the selected element, not coordinates that a late notice can
        // move. Bun resolves its current bounds when sending trusted input.
        await nativeClick(view, target, 'primary', 'click');
      } finally {
        await view
          .evaluate(
            `document.querySelector(${JSON.stringify(target)})?.removeAttribute('data-ui-testing-press-target')`
          )
          .catch(() => undefined);
      }
      return;
    }
    // Nothing pressable yet: the selector click waits for actionability.
    // Its timeout names no cause, so say whether the element kept moving
    // or what covers it.
    const selector = cssPath(this.path);
    try {
      await view.click(selector);
    } catch (error) {
      throw new UiTestError(
        `${String(error)}; ${await diagnosePress(view, selector)}`,
        { cause: error }
      );
    }
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
      `(function(){ const el = ${textFieldExpr(sel)}; if (!el) return; el.focus(); el.value = el.type === 'range' ? ${value} : el.value + ${value}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`
    );
  }

  async clear(): Promise<void> {
    const sel = JSON.stringify(cssPath(this.path));
    await (await this.view()).evaluate(
      `(function(){ const el = ${textFieldExpr(sel)}; if (!el) return; el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); })()`
    );
  }

  async selectFile(file: {
    readonly name: string;
    readonly bytes: readonly number[];
  }): Promise<void> {
    await this.waitVisible();
    await (await this.view()).evaluate(
      `(function(){ const root = document.querySelector(${JSON.stringify(cssPath(this.path))}); const input = root?.matches('input[type="file"]') ? root : root?.querySelector('input[type="file"]'); if (!input) throw new Error('File input not found'); const file = ${JSON.stringify(file)}; const data = new DataTransfer(); data.items.add(new File([new Uint8Array(file.bytes)], file.name)); input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`
    );
  }

  async key(key: DriverKey): Promise<void> {
    await pressBrowserKey(
      await this.view(),
      DRIVER_KEY_TO_DOM[key],
      cssPath(this.path)
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
          if (state === 'visible' && options?.visibleOr !== undefined) {
            const parent = this.path.slice(0, -1);
            const paths = [
              this.path,
              ...options.visibleOr.map((id) => [...parent, id]),
            ];
            const selectors = paths.map(cssPath);
            const view = await this.host.resolveView(selectors.join(', '));
            return (await view.evaluate(visibilityScript(selectors))) === true;
          }
          if (isWaitTextCondition(state)) {
            const text = await this.text().catch(() => null);
            if (text === null) return false;
            return state.exact === false
              ? text.includes(state.text)
              : text.trim() === state.text;
          }
          const visible = await this.isVisible();
          if (state !== 'enabled')
            return state === 'visible' ? visible : !visible;
          if (!visible) return false;
          // Keep nullable DOM flags on the page and return one coherent boolean.
          const enabled = await (await this.view()).evaluate(
            `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); return el !== null && (${controlIsEnabled.toString()})(el.getAttribute('disabled'), el.getAttribute('aria-disabled')); })()`
          );
          return enabled === true;
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
      visibilityScript([cssPath(this.path)])
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

  async attribute(name: string): Promise<string | null> {
    const result = await (await this.view()).evaluate(
      `(function(){ const el = document.querySelector(${JSON.stringify(cssPath(this.path))}); return el?.getAttribute(${JSON.stringify(name)}) ?? null; })()`
    );
    return typeof result === 'string' ? result : null;
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
function pressableTargetScript(selector: string): string {
  return `(async function(){
    var all = document.querySelectorAll(${JSON.stringify(selector)});
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      var previous = null;
      for (var frame = 0; frame < 18; frame++) {
        await new Promise(requestAnimationFrame);
        var r = el.getBoundingClientRect();
        var stable = previous !== null && previous.left === r.left && previous.top === r.top && previous.width === r.width && previous.height === r.height;
        previous = { left: r.left, top: r.top, width: r.width, height: r.height };
        if (!stable || r.width === 0 || r.height === 0) continue;
        var x = r.left + r.width / 2;
        var y = r.top + r.height / 2;
        var hit = document.elementFromPoint(x, y);
        if (hit !== null && (hit === el || el.contains(hit))) {
          var id = window.__uiTestingPressTargetId = (window.__uiTestingPressTargetId || 0) + 1;
          el.setAttribute('data-ui-testing-press-target', String(id));
          return '[data-ui-testing-press-target="' + id + '"]';
        }
      }
    }
    return null;
  })()`;
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
