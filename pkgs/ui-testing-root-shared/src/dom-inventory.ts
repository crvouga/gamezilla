import type { Inventory, InventoryItem } from './inventory';

/** Self-contained so browser adapters can evaluate the same observation function. */
export function readDomInventory(document: Document): Inventory {
  const visible = (element: Element): boolean => {
    for (
      let node: Element | null = element;
      node !== null;
      node = node.parentElement
    ) {
      if (
        node.hasAttribute('hidden') ||
        node.hasAttribute('inert') ||
        node.getAttribute('aria-hidden') === 'true'
      )
        return false;
      const style = document.defaultView?.getComputedStyle(node);
      if (
        style?.display === 'none' ||
        style?.visibility === 'hidden' ||
        style?.opacity === '0'
      )
        return false;
    }
    return true;
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
