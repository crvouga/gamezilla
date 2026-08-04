import {
  queryByLabelText,
  queryByRole,
  queryByTestId,
  queryByText,
} from '@testing-library/dom';
import type { Selector } from '../../selector/selector';

/** Resolve a portable {@link Selector} against a DOM container. */
export function queryElement(
  container: HTMLElement,
  selector: Selector
): Element | null {
  switch (selector.kind) {
    case 'testId':
      return queryByTestId(container, selector.value);
    case 'text':
      return queryByText(container, selector.value, {
        exact: selector.exact !== false,
      });
    case 'label':
      return queryByLabelText(container, selector.value);
    case 'role':
      return selector.name !== undefined
        ? queryByRole(container, selector.role, { name: selector.name })
        : queryByRole(container, selector.role);
  }
}

/** Best-effort visibility check for a DOM element. */
export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  const style = element.style;
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  if (style.opacity === '0') {
    return false;
  }
  return true;
}

/** Read accessible / displayed text from a DOM element. */
export function readElementText(element: Element): string | null {
  if (element instanceof HTMLInputElement) {
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  const labelled = element.getAttribute('aria-label');
  if (labelled) {
    return labelled;
  }
  const text = element.textContent?.trim() ?? '';
  return text.length > 0 ? text : null;
}
