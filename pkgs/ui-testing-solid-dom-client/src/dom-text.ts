import { collectVisibleText } from './dom-visibility';

export function isTextField(
  element: Element
): element is HTMLInputElement | HTMLTextAreaElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  );
}

/** Collapse whitespace runs and trim, like rendered inline text. */
export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * The field a node stands for: itself, or its single `<input>` / `<textarea>`
 * descendant (design-system `TextInput` puts `data-testid` on its wrapper).
 */
export function fieldOf(
  element: Element
): HTMLInputElement | HTMLTextAreaElement | null {
  if (isTextField(element)) return element;
  const fields = element.querySelectorAll('input, textarea');
  const only = fields.length === 1 ? fields[0] : undefined;
  return only !== undefined && isTextField(only) ? only : null;
}

/**
 * Displayed text of a node: field `value`, else visible subtree text, else
 * `aria-label`; `null` when nothing is readable.
 */
export function readDomText(element: Element): string | null {
  const field = fieldOf(element);
  if (field !== null) return field.value;
  const fromTree = normalizeText(collectVisibleText(element));
  if (fromTree.length > 0) return fromTree;
  const label = element.getAttribute('aria-label');
  if (label !== null && label.length > 0) return label;
  return null;
}

export function textMatches(
  actual: string | null,
  expected: string,
  exact: boolean
): boolean {
  if (exact) return actual === expected;
  return actual?.includes(expected) ?? false;
}
