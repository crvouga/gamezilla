/**
 * Whether an element is rendered, and whether it is in the accessibility tree.
 *
 * Rendering is attribute and style driven (the `hidden` attribute, inline or
 * computed `display: none` / `visibility: hidden`), so it holds in a DOM
 * without layout. "Hidden from assistive technology" adds `aria-hidden="true"`
 * and `inert` (ACT glossary "Included in the accessibility tree").
 */

function computed(element: Element): CSSStyleDeclaration | null {
  const view = element.ownerDocument.defaultView;
  if (view === null) return null;
  try {
    return view.getComputedStyle(element);
  } catch {
    return null;
  }
}

function inlineStyle(element: Element): CSSStyleDeclaration | null {
  const style = (element as Partial<ElementCSSInlineStyle>).style;
  return style ?? null;
}

/** Elements the HTML user-agent stylesheet never renders. */
const NEVER_RENDERED = new Set([
  'datalist',
  'head',
  'noscript',
  'script',
  'style',
  'template',
  'title',
]);

function neverRendered(element: Element): boolean {
  const tag = element.localName.toLowerCase();
  if (NEVER_RENDERED.has(tag)) return true;
  return tag === 'input' && element.getAttribute('type') === 'hidden';
}

function displayNone(element: Element): boolean {
  if (element.hasAttribute('hidden') || neverRendered(element)) return true;
  if (inlineStyle(element)?.display === 'none') return true;
  return computed(element)?.display === 'none';
}

function visibilityHidden(element: Element): boolean {
  const own = inlineStyle(element)?.visibility;
  if (own === 'hidden' || own === 'collapse') return true;
  if (own === 'visible') return false;
  const style = computed(element)?.visibility;
  return style === 'hidden' || style === 'collapse';
}

function* selfAndAncestors(element: Element): Generator<Element> {
  let current: Element | null = element;
  while (current !== null) {
    yield current;
    current = current.parentElement;
  }
}

/**
 * Rendered: attached, and neither it nor an ancestor is `display: none` (or
 * `hidden`), and it is not `visibility: hidden` (which inherits unless a
 * descendant sets `visible` again).
 */
export function isRendered(element: Element): boolean {
  if (!element.isConnected) return false;
  for (const node of selfAndAncestors(element)) {
    if (displayNone(node)) return false;
  }
  for (const node of selfAndAncestors(element)) {
    const own = inlineStyle(node)?.visibility;
    if (own === 'visible') return true;
    if (visibilityHidden(node)) return false;
  }
  return true;
}

/** Inside an `inert` subtree: neither focusable nor exposed. */
export function isInert(element: Element): boolean {
  return element.closest('[inert]') !== null;
}

/** Inside an `aria-hidden="true"` subtree. */
export function isAriaHidden(element: Element): boolean {
  for (const node of selfAndAncestors(element)) {
    if (node.getAttribute('aria-hidden') === 'true') return true;
  }
  return false;
}

/** Not included in the accessibility tree: not rendered, inert, or aria-hidden. */
export function isHiddenFromAt(element: Element): boolean {
  return !isRendered(element) || isInert(element) || isAriaHidden(element);
}
