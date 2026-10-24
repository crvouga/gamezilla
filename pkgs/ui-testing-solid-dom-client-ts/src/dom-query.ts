/**
 * `data-testid` lookups scoped to one actor. Portals (`solid-js/web`
 * `<Portal>`) may mount outside the actor container, so a miss inside the
 * container falls back to the whole document minus other actors' containers.
 */

export const ACTOR_ATTR = 'data-actor';

function escapeAttrValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function testIdSelector(testId: string): string {
  return `[data-testid="${escapeAttrValue(testId)}"]`;
}

function belongsToOtherActor(
  element: Element,
  container: Element | null
): boolean {
  const owner = element.closest(`[${ACTOR_ATTR}]`);
  if (owner === null) return false;
  return owner !== container;
}

/**
 * First `testId` match owned by the actor: the container subtree wins, then
 * any body-level match that is not inside a different actor's container.
 */
export function queryActorTestId(
  document: Document,
  container: Element | null,
  testId: string
): Element | null {
  const selector = testIdSelector(testId);
  const scoped = container?.querySelector(selector) ?? null;
  if (scoped !== null) return scoped;
  for (const candidate of document.querySelectorAll(selector)) {
    if (!belongsToOtherActor(candidate, container)) return candidate;
  }
  return null;
}

/** `testId` match strictly inside `parent`. */
export function queryWithinTestId(
  parent: Element,
  testId: string
): Element | null {
  return parent.querySelector(testIdSelector(testId));
}

/** Keep every named ancestor so a layout remount cannot erase locator scope. */
export function elementTestIdPath(
  element: Element,
  container: Element | null
): readonly string[] {
  const path: string[] = [];
  let current: Element | null = element;
  while (current !== null && current !== container) {
    const id = current.getAttribute('data-testid');
    if (id !== null && id !== '') path.unshift(id);
    current = current.parentElement;
  }
  return path;
}

export function queryActorTestIdPath(
  document: Document,
  container: Element | null,
  path: readonly string[]
): Element | null {
  const first = path[0];
  if (first === undefined) return null;
  let current = queryActorTestId(document, container, first);
  for (const id of path.slice(1)) {
    if (current === null) return null;
    current = queryWithinTestId(current, id);
  }
  return current;
}

export function asElement(node: unknown): Element {
  if (node instanceof Element) return node;
  throw new TypeError('solid-dom: host node is not a DOM Element');
}
