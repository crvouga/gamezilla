import type { Inventory, InventoryItem } from './inventory';

/** Self-contained so browser adapters can evaluate the same observation function. */
export function readDomInventory(document: Document): Inventory {
  // Every candidate shares most of its ancestors, and a computed style is the
  // expensive read: decide each node once per inventory, not once per
  // descendant.
  const decided = new Map<Element, boolean>();
  const hides = (node: Element): boolean => {
    if (
      node.hasAttribute('hidden') ||
      node.hasAttribute('inert') ||
      node.getAttribute('aria-hidden') === 'true'
    )
      return true;
    const style = document.defaultView?.getComputedStyle(node);
    return (
      style?.display === 'none' ||
      style?.visibility === 'hidden' ||
      style?.opacity === '0'
    );
  };
  const visible = (element: Element): boolean => {
    const known = decided.get(element);
    if (known !== undefined) return known;
    const parent = element.parentElement;
    const result = !hides(element) && (parent === null || visible(parent));
    decided.set(element, result);
    return result;
  };
  const pressables: InventoryItem[] = [];
  const inputs: InventoryItem[] = [];
  for (const element of document.querySelectorAll('[data-testid]')) {
    if (!visible(element)) continue;
    const testId = element.getAttribute('data-testid');
    if (testId === null) continue;
    const control = element.matches(
      'button,a,input,textarea,[role="button"],[role="checkbox"],[role="switch"]'
    )
      ? element
      : element.querySelector('input,textarea');
    if (
      control === null ||
      control.hasAttribute('disabled') ||
      control.getAttribute('aria-disabled') === 'true'
    )
      continue;
    const role = control.getAttribute('role') ?? control.tagName.toLowerCase();
    const item = {
      testId,
      role,
      accessibleName:
        control.getAttribute('aria-label') ??
        element.getAttribute('aria-label') ??
        '',
      structuralPath: testId,
    };
    if (control.matches('input,textarea')) inputs.push(item);
    else
      pressables.push({
        ...item,
        text: (element.textContent ?? '').trim().slice(0, 256),
      });
  }
  return {
    pressables,
    inputs,
    canGoBack: pressables.some((item) => item.testId === 'nav-back'),
    screen:
      [...document.querySelectorAll('[data-screen]')]
        .find(visible)
        ?.getAttribute('data-screen') ?? null,
    errors: [...document.querySelectorAll('[role="alert"]')]
      .filter(visible)
      .map((element) => (element.textContent ?? '').slice(0, 512)),
  };
}
