/** Pure helpers for the DOM focus trap (unit-tested without a component). */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function isVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.closest('[inert]') !== null) return false;
  return true;
}

/** Tabbable descendants in DOM order. */
export function collectTabbable(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (isVisible(el)) out.push(el);
  }
  return out;
}

/**
 * Where Tab / Shift+Tab should land when focus is at `current` inside the
 * trap. Returns `null` when the browser default should proceed (focus stays
 * strictly inside without wrapping).
 */
export function nextTabStop(
  tabbable: readonly HTMLElement[],
  current: Element | null,
  backwards: boolean
): HTMLElement | null {
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  if (first === undefined || last === undefined) return null;
  const index =
    current === null ? -1 : tabbable.indexOf(current as HTMLElement);
  if (index === -1) return backwards ? last : first;
  if (backwards) return index === 0 ? last : null;
  return index === tabbable.length - 1 ? first : null;
}
