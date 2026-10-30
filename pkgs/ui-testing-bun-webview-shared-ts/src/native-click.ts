// @io-wall-ok — browser driver adapter observes trusted input with page wall timers.
import type { PointerButton } from '@pkgs/ui-testing-root-shared-ts/driver';
import { UiTestError } from '@pkgs/ui-testing-root-shared-ts/ui-test-error';
import type { BunWebView } from './bun-webview-host';

/** Page-side counters of trusted `pointerdown`s / `pointerup`s (installed once per document). */
function pointerCounterScript(selector: string | undefined): string {
  return `(function () {
  if (window.__uiTestingPointerCounts === undefined) {
    var counts = { down: 0, up: 0, click: 0, selector: null, matchesTarget: false, hit: '' };
    window.__uiTestingPointerCounts = counts;
    document.addEventListener('pointerdown', function (e) {
      if (e.isTrusted) counts.down += 1;
    }, true);
    document.addEventListener('pointerup', function (e) {
      if (e.isTrusted) counts.up += 1;
    }, true);
    document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      counts.click += 1;
      var elements = e.composedPath().filter(function (node) { return node instanceof Element; });
      counts.matchesTarget = counts.selector === null || elements.some(function (node) { return node.matches(counts.selector); });
      counts.hit = elements.slice(0, 4).map(function (node) { return node.tagName + '[data-testid=' + (node.getAttribute('data-testid') || '').slice(0, 120) + ']'; }).join(' < ');
    }, true);
  }
  var counts = window.__uiTestingPointerCounts;
  counts.selector = ${JSON.stringify(selector ?? null)};
  return [counts.down, counts.up, counts.click, performance.timeOrigin,
    counts.matchesTarget, counts.hit];
})()`;
}

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
  readonly matchesTarget: boolean;
  readonly hit: string;
};

async function readPointerCounts(
  view: BunWebView,
  selector?: string
): Promise<PointerCounts> {
  const raw = await view.evaluate(pointerCounterScript(selector));
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
    matchesTarget: raw[4] === true,
    hit: typeof raw[5] === 'string' ? raw[5] : 'unknown',
  };
}

function clickProgress(
  completion: 'pointer' | 'click',
  counts: PointerCounts,
  initial: PointerCounts
): 'delivered' | 'pending' | 'send' {
  if (completion !== 'click') return 'send';
  if (counts.documentId !== initial.documentId) return 'delivered';
  if (counts.click > initial.click) {
    if (!counts.matchesTarget)
      throw new UiTestError(
        `Bun.WebView: trusted click missed the selected control; hit ${counts.hit}`
      );
    return 'delivered';
  }
  return counts.down > initial.down && counts.up > initial.up
    ? 'pending'
    : 'send';
}

function sendNativeClick(
  view: BunWebView,
  target: string | { readonly x: number; readonly y: number },
  button: PointerButton
): Promise<void> {
  if (typeof target === 'string') return view.click(target);
  return view.click(target.x, target.y, {
    button: button === 'secondary' ? 'right' : 'left',
  });
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
export async function nativeClick(
  view: BunWebView,
  target: string | { readonly x: number; readonly y: number },
  button: PointerButton = 'primary',
  completion: 'pointer' | 'click' = 'pointer'
): Promise<void> {
  const awaitsRelease = button !== 'secondary';
  let pressed = false;
  let initial: PointerCounts | null = null;
  const selector = typeof target === 'string' ? target : undefined;
  for (let attempt = 1; attempt <= NATIVE_CLICK_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await view.evaluate(RESEND_PAUSE);
    const before = await readPointerCounts(view, selector);
    initial ??= before;
    const progress = clickProgress(completion, before, initial);
    if (progress === 'delivered') return;
    // A complete press may still have its click queued in the page event loop.
    if (progress === 'pending') continue;
    await sendNativeClick(view, target, button);
    const after = await readPointerCounts(view, selector);
    // A form navigation replaces the counters; the old click has already landed.
    if (after.documentId !== before.documentId) return;
    if (completion === 'click') {
      if (clickProgress(completion, after, initial) === 'delivered') return;
      continue;
    }
    pressed ||= after.down > before.down;
    if (pressed && (!awaitsRelease || after.up > before.up)) return;
  }
  throw new UiTestError(
    `Bun.WebView: native click at ${JSON.stringify(target)} never delivered a whole press after ${NATIVE_CLICK_ATTEMPTS} attempts`
  );
}
