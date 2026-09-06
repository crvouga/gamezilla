/**
 * User-visibility heuristic for happy-dom. Layout is not computed there, so
 * visibility is attribute / style driven: attached, no `hidden` / `inert` /
 * `aria-hidden="true"` ancestor, and no `display:none` / `visibility:hidden`
 * in inline or (best-effort) computed style.
 */

function styleHides(style: CSSStyleDeclaration | null | undefined): boolean {
  if (style === null || style === undefined) return false;
  return style.display === 'none' || style.visibility === 'hidden';
}

function computedStyleHides(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  if (view === null) return false;
  try {
    return styleHides(view.getComputedStyle(element));
  } catch {
    return false;
  }
}

function elementHides(element: Element): boolean {
  if (element.hasAttribute('hidden')) return true;
  if (element.hasAttribute('inert')) return true;
  if (element.getAttribute('aria-hidden') === 'true') return true;
  if (element instanceof HTMLElement && styleHides(element.style)) return true;
  return computedStyleHides(element);
}

/** True when `element` and every ancestor are attached and not hidden. */
export function isDomVisible(element: Element): boolean {
  if (!element.isConnected) return false;
  let current: Element | null = element;
  while (current !== null) {
    if (elementHides(current)) return false;
    current = current.parentElement;
  }
  return true;
}

/**
 * Subtree text that a user can see. Skips hidden branches so width-lock /
 * `aria-hidden` spacers (e.g. Button feedback labels) do not concatenate.
 */
export function collectVisibleText(element: Element): string {
  let out = '';
  for (const child of element.childNodes) {
    if (child.nodeType === child.TEXT_NODE) {
      out += child.textContent ?? '';
      continue;
    }
    if (!(child instanceof Element)) continue;
    if (elementHides(child)) continue;
    out += collectVisibleText(child);
  }
  return out;
}
