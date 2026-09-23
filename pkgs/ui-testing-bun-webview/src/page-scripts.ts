/**
 * Page-side expressions for {@link BunWebviewDriverNode}. Semantics match the
 * happy-dom driver (`@pkgs/ui-testing-solid-dom` `dom-visibility` /
 * `dom-text`) so the same scenarios read the same UI on either host:
 *
 * - visible — attached, and no ancestor is `hidden` / `inert` /
 *   `aria-hidden="true"` / `display:none` / `visibility:hidden`
 * - text — the node's field `value` (itself or its single `<input>` /
 *   `<textarea>`), else its visible subtree text (whitespace collapsed),
 *   else `aria-label`
 *
 * A path can match several nodes on a real layout (e.g. a measuring copy of
 * an action bar); the node is the first *visible* match, else the first.
 *
 * Every expression is self-contained: `Bun.WebView.evaluate` takes one
 * expression per call.
 */

/** Marks the resolved node so a native `click(selector)` hits exactly it. */
export const TAP_TARGET_ATTR = 'data-bun-webview-target';

const HELPERS = `
  const hides = (el) => {
    if (el.hasAttribute('hidden') || el.hasAttribute('inert')) return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    const s = getComputedStyle(el);
    return s.display === 'none' || s.visibility === 'hidden';
  };
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    for (let cur = el; cur !== null; cur = cur.parentElement) {
      if (hides(cur)) return false;
    }
    return true;
  };
  const isField = (el) =>
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  const fieldOf = (el) => {
    if (isField(el)) return el;
    const all = el.querySelectorAll('input, textarea');
    return all.length === 1 && isField(all[0]) ? all[0] : null;
  };
  const anyField = (el) => fieldOf(el) ?? el.querySelector('input, textarea');
  const visibleText = (el) => {
    let out = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) { out += child.textContent ?? ''; continue; }
      if (!(child instanceof Element) || hides(child)) continue;
      out += visibleText(child);
    }
    return out;
  };
  const resolve = (selector) => {
    const all = [...document.querySelectorAll(selector)];
    return all.find(visible) ?? all[0] ?? null;
  };
  const text = (el) => {
    const field = fieldOf(el);
    if (field !== null) return field.value;
    const tree = visibleText(el).replace(/\\s+/g, ' ').trim();
    if (tree.length > 0) return tree;
    const label = el.getAttribute('aria-label');
    return label !== null && label.length > 0 ? label : null;
  };
`;

function withElement(selector: string, body: string, missing: string): string {
  return `(function(){ ${HELPERS} const el = resolve(${JSON.stringify(selector)}); if (!el) return ${missing}; ${body} })()`;
}

/** Tag the resolved node as the only {@link TAP_TARGET_ATTR} on the page. */
export function markTapTargetScript(selector: string): string {
  return withElement(
    selector,
    `for (const prev of document.querySelectorAll('[${TAP_TARGET_ATTR}]')) prev.removeAttribute('${TAP_TARGET_ATTR}'); el.setAttribute('${TAP_TARGET_ATTR}', ''); return true;`,
    'false'
  );
}

export function isVisibleScript(selector: string): string {
  return withElement(selector, 'return visible(el);', 'false');
}

/** `{ text }` so a present node with no readable text stays distinct from a miss. */
export function textScript(selector: string): string {
  return withElement(selector, 'return { text: text(el) };', 'null');
}

/**
 * Focus the node's field with the caret at the end (like a user click) so
 * native `type` appends. `select` instead selects the whole value for a
 * native delete. Returns false when the node has no text field.
 */
export function focusFieldScript(
  selector: string,
  caret: 'end' | 'select'
): string {
  const place =
    caret === 'select'
      ? 'field.select();'
      : 'const n = field.value.length; field.setSelectionRange(n, n);';
  return withElement(
    selector,
    `const field = anyField(el); if (field === null) return false; field.focus(); ${place} return true;`,
    'false'
  );
}

export type PagePoint = { readonly x: number; readonly y: number };

/**
 * Pointer + mouse press / move / release on the node, like the happy-dom
 * driver's `fireDrag` (boards map `clientX/Y` against their own rect).
 */
export function dragScript(
  selector: string,
  start: PagePoint,
  end: PagePoint
): string {
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return withElement(
    selector,
    `
    const fire = (phase, p) => {
      const init = { bubbles: true, cancelable: true, composed: true, pointerId: 1,
        pointerType: 'mouse', isPrimary: true, button: phase === 'move' ? -1 : 0,
        buttons: phase === 'up' ? 0 : 1, clientX: p.x, clientY: p.y, screenX: p.x, screenY: p.y };
      el.dispatchEvent(new PointerEvent('pointer' + phase, init));
      el.dispatchEvent(new MouseEvent(phase === 'down' ? 'mousedown' : phase === 'up' ? 'mouseup' : 'mousemove', init));
    };
    fire('down', ${JSON.stringify(start)});
    fire('move', ${JSON.stringify(mid)});
    fire('move', ${JSON.stringify(end)});
    fire('up', ${JSON.stringify(end)});
    return true;`,
    'false'
  );
}

export function layoutScript(selector: string): string {
  return withElement(
    selector,
    'const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };',
    'null'
  );
}

export function scrollScript(selector: string, dx: number, dy: number): string {
  return withElement(
    selector,
    `el.scrollBy(${String(dx)}, ${String(dy)}); return true;`,
    'false'
  );
}

/** Test ids currently visible on the page — context for a timed-out wait. */
export function visibleTestIdsScript(): string {
  return `(function(){ ${HELPERS} return [...document.querySelectorAll('[data-testid]')].filter(visible).map((el) => el.getAttribute('data-testid')); })()`;
}

/**
 * What a native click at the node's center would hit instead of the node:
 * `null` when the node itself (or a descendant) is topmost, else a short
 * `component/testid` chain for the covering element.
 */
export function obstructionScript(selector: string): string {
  return withElement(
    selector,
    `const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'outside viewport at ' + Math.round(x) + ',' + Math.round(y);
    const top = document.elementFromPoint(x, y);
    if (top === null || el.contains(top)) return null;
    const chain = [];
    for (let c = top; c !== null && chain.length < 4; c = c.parentElement) {
      chain.push(c.getAttribute('data-testid') ?? c.getAttribute('data-component') ?? c.tagName.toLowerCase());
    }
    return chain.join(' < ');`,
    "'missing'"
  );
}
