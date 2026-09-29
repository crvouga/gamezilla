/**
 * Focusability and the sequential focus navigation order (HTML § 6.6.3):
 * which elements the Tab key visits, and in which order. Elements with a
 * positive `tabindex` come first in ascending value, then every element with
 * a zero `tabindex` (explicit or native) in tree order. Disabled, inert and
 * unrendered elements are never focusable; a radio group is one stop.
 */

import { tagOf } from './roles';
import { isInert, isRendered } from './visibility';

/** HTML "rules for parsing integers": `null` when the attribute is not one. */
export function parseTabIndex(raw: string | null): number | null {
  if (raw === null) return null;
  const match = /^[\t\n\f\r ]*([-+]?\d+)/.exec(raw);
  if (match === null || match[1] === undefined) return null;
  return Number.parseInt(match[1], 10);
}

const DISABLEABLE = new Set([
  'button',
  'fieldset',
  'input',
  'optgroup',
  'option',
  'select',
  'textarea',
]);

function inDisabledFieldset(element: Element): boolean {
  const fieldset = element.parentElement?.closest('fieldset[disabled]') ?? null;
  if (fieldset === null) return false;
  const legend = Array.from(fieldset.children).find(
    (child) => tagOf(child) === 'legend'
  );
  return legend === undefined || !legend.contains(element);
}

/** Actually disabled (HTML § 4.10.18.5), so neither focusable nor operable. */
export function isDisabled(element: Element): boolean {
  if (!DISABLEABLE.has(tagOf(element))) return false;
  return element.hasAttribute('disabled') || inDisabledFieldset(element);
}

function isSummaryOfDetails(element: Element): boolean {
  const parent = element.parentElement;
  if (parent === null || tagOf(parent) !== 'details') return false;
  return parent.querySelector(':scope > summary') === element;
}

function contentEditable(element: Element): boolean {
  const value = element.getAttribute('contenteditable');
  return value === '' || value?.toLowerCase() === 'true';
}

/** Focusable by default, without a `tabindex` (HTML focusable areas). */
export function isNativelyFocusable(element: Element): boolean {
  const tag = tagOf(element);
  if (tag === 'a' || tag === 'area') return element.hasAttribute('href');
  if (tag === 'input') return element.getAttribute('type') !== 'hidden';
  if (['button', 'select', 'textarea', 'iframe'].includes(tag)) return true;
  if (tag === 'audio' || tag === 'video') {
    return element.hasAttribute('controls');
  }
  if (tag === 'summary') return isSummaryOfDetails(element);
  return contentEditable(element);
}

/** The element's tabindex value, or `null` when it is not focusable at all. */
export function tabIndexOf(element: Element): number | null {
  const parsed = parseTabIndex(element.getAttribute('tabindex'));
  if (parsed !== null) return parsed;
  return isNativelyFocusable(element) ? 0 : null;
}

/** Focusable by a person or a script: rendered, not inert, not disabled. */
export function isFocusable(element: Element): boolean {
  if (tabIndexOf(element) === null) return false;
  if (isDisabled(element) || isInert(element)) return false;
  return isRendered(element);
}

/** In the sequential focus navigation order: focusable with tabindex ≥ 0. */
export function isSequentiallyFocusable(element: Element): boolean {
  return isFocusable(element) && (tabIndexOf(element) ?? -1) >= 0;
}

function radioGroupKey(element: Element): string | null {
  if (tagOf(element) !== 'input') return null;
  if (element.getAttribute('type') !== 'radio') return null;
  const name = element.getAttribute('name');
  if (name === null || name.length === 0) return null;
  const form = element.closest('form');
  const formIndex = form === null ? -1 : indexIn(element.ownerDocument, form);
  return `${String(formIndex)}:${name}`;
}

function indexIn(doc: Document, element: Element): number {
  return Array.from(doc.getElementsByTagName('*')).indexOf(element);
}

function isChecked(element: Element): boolean {
  return (element as Partial<HTMLInputElement>).checked === true;
}

/** A radio group is one stop: its checked radio, else its first. */
function collapseRadioGroups(order: readonly Element[]): Element[] {
  const groups = new Map<string, Element[]>();
  for (const element of order) {
    const key = radioGroupKey(element);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), element]);
  }
  const keep = new Set<Element>();
  for (const members of groups.values()) {
    const stop = members.find(isChecked) ?? members[0];
    if (stop !== undefined) keep.add(stop);
  }
  return order.filter(
    (element) => radioGroupKey(element) === null || keep.has(element)
  );
}

/** Every element of `root` (itself included) in tree order. */
export function treeOrder(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll('*'))];
}

/** The order the Tab key visits the sequentially focusable elements of `root`. */
export function sequentialFocusOrder(root: Element): Element[] {
  const focusable = treeOrder(root).filter(isSequentiallyFocusable);
  const positive = focusable
    .filter((element) => (tabIndexOf(element) ?? 0) > 0)
    .map((element, index) => ({ element, index }))
    .sort(
      (a, b) =>
        (tabIndexOf(a.element) ?? 0) - (tabIndexOf(b.element) ?? 0) ||
        a.index - b.index
    )
    .map(({ element }) => element);
  const zero = focusable.filter((element) => tabIndexOf(element) === 0);
  return collapseRadioGroups([...positive, ...zero]);
}

function follows(element: Element, anchor: Element): boolean {
  const FOLLOWING = 4;
  return (anchor.compareDocumentPosition(element) & FOLLOWING) !== 0;
}

/**
 * Where Tab (or Shift+Tab when `backwards`) moves focus from `current`
 * within `root`: the next stop in {@link sequentialFocusOrder}, or `null`
 * when focus leaves `root` (past the last stop). From outside the order (the
 * body, or a `tabindex="-1"` element) it goes to the first stop after
 * `current` in tree order.
 */
export function nextInFocusOrder(
  root: Element,
  current: Element | null,
  backwards = false
): Element | null {
  const order = sequentialFocusOrder(root);
  const at = current === null ? -1 : order.indexOf(current);
  if (at >= 0) return order[backwards ? at - 1 : at + 1] ?? null;
  const inside = current !== null && current !== root && root.contains(current);
  if (!inside) return (backwards ? order.at(-1) : order[0]) ?? null;
  const after = order.filter((element) => follows(element, current));
  const before = order.filter((element) => !follows(element, current));
  return (backwards ? before.at(-1) : after[0]) ?? null;
}
