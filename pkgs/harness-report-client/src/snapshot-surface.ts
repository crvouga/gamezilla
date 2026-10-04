import {
  cleanSnapshotHtml,
  PHONE_H,
  PHONE_W,
} from '@pkgs/harness-report-shared/phone';
import type { ReportStepHit } from '@pkgs/harness-shared/report-types';

/**
 * One long-lived snapshot surface per client panel. Frames are painted by
 * swapping the parsed snapshot DOM into that surface synchronously, so
 * scrubbing never re-parses `frameCss` or refetches fonts. The press target
 * is resolved against the painted DOM with the driver's chained first-match
 * semantics and drawn as a single overlay from real layout.
 *
 * The phone paints into an open shadow tree, not an iframe: embedded
 * browsers drop iframe documents, and a shadow tree stays in the page.
 * Snapshot styles sit on the shadow root, and the host is the 390×844
 * viewport the app shell fills.
 */

const FRAME_CSS_ID = 'sr-frame-css';
const OVERLAY_ID = 'sr-press';
const SNAP_ATTR = 'data-sr-snap';
const PARSE_CACHE_MAX = 256;

const OVERLAY_CSS = `#${OVERLAY_ID}{position:absolute;display:none;pointer-events:none;z-index:2147483647;box-sizing:border-box;border:2px solid #ff5a8a;border-radius:6px;box-shadow:0 0 0 4px rgba(255,90,138,.35)}#${OVERLAY_ID} i{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#ff5a8a;box-shadow:0 0 0 4px rgba(255,90,138,.35)}`;

export type HitResult = 'none' | 'found' | 'missing';

type SnapRoot = {
  readonly head: HTMLElement;
  readonly body: HTMLElement;
  readonly documentElement: HTMLElement;
  /** Adopted `<style>` / `<link>` live here, never under `display`. */
  readonly sheets: HTMLElement | ShadowRoot;
  readonly scopeCss: boolean;
  /** Viewport classes attribute sync must not drop. Lookup and layout use them. */
  readonly docClass: string | null;
  readonly bodyClass: string | null;
  getElementById(id: string): HTMLElement | null;
  importNode(node: Node, deep: boolean): Node;
  createElement(tag: string): HTMLElement;
};

type ParsedSnapshot = {
  readonly headKey: string;
  readonly head: readonly Node[];
  readonly body: HTMLElement;
  readonly htmlAttrs: readonly Attr[];
};

type LocalBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

const parseCache = new Map<string, ParsedSnapshot>();

/**
 * Point `html` / `body` / `:root` at the phone viewport, and turn a full
 * browser viewport unit into a percentage of that box.
 */
export function scopeSnapshotCss(css: string): string {
  const scoped = css.replace(
    /(^|[^\w-])(:root|html|body)(?![\w-])/g,
    (_match, prefix: string, token: string) =>
      `${prefix}${token === 'body' ? '.sr-snap-body' : '.sr-snap-doc'}`
  );
  return scoped.replace(/\b100(?:d|s|l)?v[hw]\b/g, '100%');
}

/** Changes when the snapshot bytes change, even if the file name does not. */
function contentStamp(key: string, html: string): string {
  let hash = 5381;
  for (let i = 0; i < html.length; i += 1) {
    hash = Math.imul(hash, 33) ^ html.charCodeAt(i);
  }
  return `${key}:${(hash >>> 0).toString(16)}`;
}

function parseSnapshot(key: string, html: string): ParsedSnapshot {
  const cached = parseCache.get(key);
  if (cached) return cached;
  const doc = new DOMParser().parseFromString(
    cleanSnapshotHtml(html),
    'text/html'
  );
  const parsed: ParsedSnapshot = {
    headKey: doc.head.innerHTML,
    head: Array.from(doc.head.childNodes),
    body: doc.body,
    htmlAttrs: Array.from(doc.documentElement.attributes),
  };
  if (parseCache.size >= PARSE_CACHE_MAX) {
    const oldest = parseCache.keys().next().value;
    if (oldest !== undefined) parseCache.delete(oldest);
  }
  parseCache.set(key, parsed);
  return parsed;
}

function shellHtml(frameCss: string): string {
  const base = `html,body{margin:0}html{position:relative}${OVERLAY_CSS}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style id="${FRAME_CSS_ID}">${frameCss}${base}</style></head><body></body></html>`;
}

/** Make sure `doc` is our standards-mode shell with `frameCss` installed. */
export function ensureShell(doc: Document, frameCss: string): void {
  if (doc.getElementById(FRAME_CSS_ID)) return;
  doc.open();
  doc.write(shellHtml(frameCss));
  doc.close();
}

function documentRoot(doc: Document): SnapRoot {
  return {
    head: doc.head,
    body: doc.body,
    documentElement: doc.documentElement,
    sheets: doc.head,
    scopeCss: false,
    docClass: null,
    bodyClass: null,
    getElementById: (id) => doc.getElementById(id),
    importNode: (node, deep) => doc.importNode(node, deep),
    createElement: (tag) => doc.createElement(tag),
  };
}

/** Keep `token` on `el` after a snapshot overwrites its class. */
function pinClass(el: Element, token: string | null): void {
  if (!token) return;
  const parts = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  if (parts.includes(token)) return;
  parts.push(token);
  el.setAttribute('class', parts.join(' '));
}

function syncAttributes(target: Element, attrs: readonly Attr[]): void {
  const keep = new Set(attrs.map((attr) => attr.name));
  for (const attr of Array.from(target.attributes)) {
    if (!keep.has(attr.name)) target.removeAttribute(attr.name);
  }
  for (const attr of attrs) {
    if (target.getAttribute(attr.name) !== attr.value) {
      target.setAttribute(attr.name, attr.value);
    }
  }
}

function adoptHead(root: SnapRoot, node: Node): HTMLElement | null {
  if (node.nodeType !== 1) return null;
  const copy = root.importNode(node, true) as HTMLElement;
  if (root.scopeCss && copy.tagName === 'STYLE') {
    copy.textContent = scopeSnapshotCss(copy.textContent ?? '');
  }
  copy.setAttribute(SNAP_ATTR, '');
  return copy;
}

function isSheetNode(node: HTMLElement): boolean {
  const tag = node.tagName;
  return tag === 'STYLE' || tag === 'LINK' || tag === 'BASE';
}

function clearAdopted(root: SnapRoot): void {
  for (const old of Array.from(root.head.querySelectorAll(`[${SNAP_ATTR}]`))) {
    old.remove();
  }
  if (root.sheets === root.head) return;
  for (const old of Array.from(
    root.sheets.querySelectorAll(`[${SNAP_ATTR}]`)
  )) {
    old.remove();
  }
}

/** Styles go on the shadow root. A `display` wrapper drops them in Chromium. */
function placeAdopted(root: SnapRoot, copy: HTMLElement): void {
  const parent = isSheetNode(copy) ? root.sheets : root.head;
  const frame = root.getElementById(FRAME_CSS_ID);
  if (frame && frame.parentNode === parent) parent.insertBefore(copy, frame);
  else parent.appendChild(copy);
}

function syncHead(root: SnapRoot, parsed: ParsedSnapshot): void {
  if (root.head.getAttribute(SNAP_ATTR) === parsed.headKey) return;
  clearAdopted(root);
  for (const node of parsed.head) {
    const copy = adoptHead(root, node);
    if (!copy) continue;
    placeAdopted(root, copy);
  }
  root.head.setAttribute(SNAP_ATTR, parsed.headKey);
}

function testIdSelector(id: string): string {
  return `[data-testid="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

/** Chained first match — mirrors how the UI driver resolves `get(a).get(b)`. */
export function resolveHitTarget(
  scope: ParentNode,
  path: readonly string[]
): Element | null {
  let current: ParentNode = scope;
  let found: Element | null = null;
  for (const id of path) {
    found = current.querySelector(testIdSelector(id));
    if (!found) return null;
    current = found;
  }
  return found;
}

function overlayEl(root: SnapRoot): HTMLElement {
  const existing = root.getElementById(OVERLAY_ID);
  if (existing) return existing;
  const el = root.createElement('div');
  el.id = OVERLAY_ID;
  el.appendChild(root.createElement('i'));
  root.documentElement.appendChild(el);
  return el;
}

function hideOverlay(root: SnapRoot): void {
  const el = root.getElementById(OVERLAY_ID);
  if (el) el.style.display = 'none';
}

function localBox(box: HTMLElement, target: Element): LocalBox {
  const boxRect = box.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const sx =
    boxRect.width > 0 && box.clientWidth > 0
      ? boxRect.width / box.clientWidth
      : 1;
  const sy =
    boxRect.height > 0 && box.clientHeight > 0
      ? boxRect.height / box.clientHeight
      : 1;
  return {
    left: (rect.left - boxRect.left) / sx,
    top: (rect.top - boxRect.top) / sy,
    width: rect.width / sx,
    height: rect.height / sy,
  };
}

function placeOverlay(
  root: SnapRoot,
  target: Element,
  hit: ReportStepHit
): void {
  const view = root.body;
  let box = localBox(root.documentElement, target);
  if (box.top + box.height < 0 || box.top > view.clientHeight) {
    target.scrollIntoView({ block: 'center' });
    box = localBox(root.documentElement, target);
  }
  const point = hit.point ?? { xRatio: 0.5, yRatio: 0.5 };
  const el = overlayEl(root);
  el.style.display = 'block';
  el.style.left = `${box.left - 3}px`;
  el.style.top = `${box.top - 3}px`;
  el.style.width = `${box.width + 6}px`;
  el.style.height = `${box.height + 6}px`;
  const dot = el.firstElementChild as HTMLElement | null;
  if (dot) {
    dot.style.left = `${3 + box.width * point.xRatio}px`;
    dot.style.top = `${3 + box.height * point.yRatio}px`;
  }
}

function drawOn(root: SnapRoot, hit: ReportStepHit | null): HitResult {
  if (!hit || hit.path.length === 0) {
    hideOverlay(root);
    return 'none';
  }
  const target = resolveHitTarget(root.documentElement, hit.path);
  if (!target) {
    hideOverlay(root);
    return 'missing';
  }
  placeOverlay(root, target, hit);
  return 'found';
}

/** Draw the one press overlay on `hit`'s target. */
export function drawHit(doc: Document, hit: ReportStepHit | null): HitResult {
  return drawOn(documentRoot(doc), hit);
}

function paintRoot(
  root: SnapRoot,
  snap: { readonly key: string; readonly html: string },
  hit: ReportStepHit | null
): HitResult {
  const parsed = parseSnapshot(snap.key, snap.html);
  syncHead(root, parsed);
  syncAttributes(root.documentElement, parsed.htmlAttrs);
  pinClass(root.documentElement, root.docClass);
  syncAttributes(root.body, Array.from(parsed.body.attributes));
  pinClass(root.body, root.bodyClass);
  root.body.replaceChildren(
    ...Array.from(parsed.body.childNodes, (node) => root.importNode(node, true))
  );
  root.body.scrollTop = 0;
  return drawOn(root, hit);
}

/**
 * Paint one snapshot into `doc` (already a shell) and draw `hit`. `key`
 * identifies the snapshot for parse caching.
 */
export function paintSnapshot(
  doc: Document,
  snap: { readonly key: string; readonly html: string },
  hit: ReportStepHit | null
): HitResult {
  return paintRoot(documentRoot(doc), snap, hit);
}

const PHONE_BOX = `width:${String(PHONE_W)}px;height:${String(PHONE_H)}px`;
/** Shell fill. Unlayered, so it wins over the layered theme host. */
const HOST_FILL = [
  'display:flex;flex-direction:column;flex:1 1 auto;',
  'min-width:0;min-height:0;width:100%;height:100%;overflow:hidden;',
  'background-color:var(--ui-color-background,#121418);',
  'color:var(--ui-color-text,#f4f6f8)',
].join('');
const HOST_LAYOUT = [
  `:host{display:block;${PHONE_BOX};background:#121418;color:#f4f6f8;`,
  'font:16px/1.45 system-ui,sans-serif}',
  `.sr-snap-doc{position:relative;${PHONE_BOX};display:flex;`,
  'flex-direction:column;overflow:hidden}',
  `.sr-snap-body{position:relative;${PHONE_BOX};display:flex;`,
  'flex-direction:column;flex:1 1 auto;min-height:0;overflow:hidden}',
  '.sr-snap-head{display:none}',
  '.sr-snap-body>#root,.sr-snap-body>.dom-root,.sr-snap-body>.themeHost,',
  '#root>.themeHost,.dom-root>.themeHost,.dom-root>*>.themeHost',
  `{${HOST_FILL}}`,
].join('');

/** In-page snapshot surface. No iframe. */
export function createSnapshotHost(): HTMLDivElement {
  const host = document.createElement('div');
  host.className = 'sr-snap';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.id = FRAME_CSS_ID;
  const docEl = document.createElement('div');
  docEl.className = 'sr-snap-doc';
  const head = document.createElement('div');
  head.className = 'sr-snap-head';
  const body = document.createElement('div');
  body.className = 'sr-snap-body';
  docEl.append(head, body);
  shadow.append(docEl, style);
  return host;
}

function hostRoot(host: HTMLElement): SnapRoot | null {
  const shadow = host.shadowRoot;
  const documentElement = shadow?.querySelector('.sr-snap-doc');
  const head = shadow?.querySelector('.sr-snap-head');
  const body = shadow?.querySelector('.sr-snap-body');
  if (!shadow || !documentElement || !head || !body) return null;
  if (
    !('style' in documentElement) ||
    !('style' in head) ||
    !('style' in body)
  ) {
    return null;
  }
  return {
    head: head as HTMLElement,
    body: body as HTMLElement,
    documentElement: documentElement as HTMLElement,
    sheets: shadow,
    scopeCss: true,
    docClass: 'sr-snap-doc',
    bodyClass: 'sr-snap-body',
    getElementById: (id) => shadow.getElementById(id),
    importNode: (node, deep) => document.importNode(node, deep),
    createElement: (tag) => document.createElement(tag),
  };
}

function installHostCss(root: SnapRoot, frameCss: string): void {
  const style = root.getElementById(FRAME_CSS_ID);
  if (!style) return;
  const next = `${scopeSnapshotCss(frameCss)}${HOST_LAYOUT}${OVERLAY_CSS}`;
  if (style.textContent !== next) style.textContent = next;
}

/** Paint one snapshot into the shadow tree `createSnapshotHost` built. */
export function paintSnapshotHost(
  host: HTMLElement,
  snap: { readonly key: string; readonly html: string; readonly css: string },
  hit: ReportStepHit | null
): HitResult {
  const root = hostRoot(host);
  if (!root) return 'none';
  installHostCss(root, snap.css);
  const stamp = contentStamp(snap.key, snap.html);
  if (host.dataset['snap'] === stamp && root.body.childNodes.length > 0) {
    return drawOn(root, hit);
  }
  const result = paintRoot(root, { key: stamp, html: snap.html }, hit);
  host.dataset['snap'] = stamp;
  void root.body.offsetHeight;
  return result;
}
