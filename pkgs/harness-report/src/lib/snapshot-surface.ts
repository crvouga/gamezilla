import type { ReportStepHit } from '@pkgs/harness';

import { cleanSnapshotHtml, PHONE_H, PHONE_W } from './phone';

/**
 * One long-lived snapshot document per client panel. Frames are painted by
 * swapping the parsed snapshot DOM into the same document synchronously, so
 * scrubbing never reloads an iframe, re-parses `frameCss` or refetches fonts
 * (no blank / unstyled flashes). The press target is resolved against the
 * painted DOM with the driver's chained first-match semantics and drawn as a
 * single overlay from real layout.
 */

const FRAME_CSS_ID = 'sr-frame-css';
const OVERLAY_ID = 'sr-press';
const SNAP_ATTR = 'data-sr-snap';
const PARSE_CACHE_MAX = 256;

export type HitResult = 'none' | 'found' | 'missing';

type ParsedSnapshot = {
  readonly headKey: string;
  readonly head: readonly Node[];
  readonly body: HTMLElement;
  readonly htmlAttrs: readonly Attr[];
};

const parseCache = new Map<string, ParsedSnapshot>();

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
  const base = `html,body{margin:0}#${OVERLAY_ID}{position:fixed;display:none;pointer-events:none;z-index:2147483647;box-sizing:border-box;border:2px solid #ff5a8a;border-radius:6px;box-shadow:0 0 0 4px rgba(255,90,138,.35)}#${OVERLAY_ID} i{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#ff5a8a;box-shadow:0 0 0 4px rgba(255,90,138,.35)}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style id="${FRAME_CSS_ID}">${frameCss}${base}</style></head><body></body></html>`;
}

/** Make sure `doc` is our standards-mode shell with `frameCss` installed. */
export function ensureShell(doc: Document, frameCss: string): void {
  if (doc.getElementById(FRAME_CSS_ID)) return;
  doc.open();
  doc.write(shellHtml(frameCss));
  doc.close();
}

function syncAttributes(target: Element, attrs: readonly Attr[]): void {
  const keep = new Set(attrs.map((a) => a.name));
  for (const attr of Array.from(target.attributes)) {
    if (!keep.has(attr.name)) target.removeAttribute(attr.name);
  }
  for (const attr of attrs) {
    if (target.getAttribute(attr.name) !== attr.value) {
      target.setAttribute(attr.name, attr.value);
    }
  }
}

function syncHead(doc: Document, parsed: ParsedSnapshot): void {
  const frameStyle = doc.getElementById(FRAME_CSS_ID);
  if (doc.head.getAttribute(SNAP_ATTR) === parsed.headKey) return;
  for (const old of Array.from(doc.head.querySelectorAll(`[${SNAP_ATTR}]`))) {
    old.remove();
  }
  for (const node of parsed.head) {
    if (node.nodeType !== 1) continue;
    const copy = doc.importNode(node, true) as Element;
    copy.setAttribute(SNAP_ATTR, '');
    // Snapshot styles first; frameCss (app CSS) keeps the final say.
    doc.head.insertBefore(copy, frameStyle);
  }
  doc.head.setAttribute(SNAP_ATTR, parsed.headKey);
}

function testIdSelector(id: string): string {
  return `[data-testid="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

/** Chained first match — mirrors how the UI driver resolves `get(a).get(b)`. */
export function resolveHitTarget(
  doc: Document,
  path: readonly string[]
): Element | null {
  let scope: ParentNode = doc;
  let found: Element | null = null;
  for (const id of path) {
    found = scope.querySelector(testIdSelector(id));
    if (!found) return null;
    scope = found;
  }
  return found;
}

function overlayEl(doc: Document): HTMLElement {
  const existing = doc.getElementById(OVERLAY_ID);
  if (existing) return existing;
  const el = doc.createElement('div');
  el.id = OVERLAY_ID;
  el.appendChild(doc.createElement('i'));
  doc.documentElement.appendChild(el);
  return el;
}

function hideOverlay(doc: Document): void {
  const el = doc.getElementById(OVERLAY_ID);
  if (el) el.style.display = 'none';
}

/** Draw the one press overlay on `hit`'s target. */
export function drawHit(doc: Document, hit: ReportStepHit | null): HitResult {
  if (!hit || hit.path.length === 0) {
    hideOverlay(doc);
    return 'none';
  }
  const target = resolveHitTarget(doc, hit.path);
  if (!target) {
    hideOverlay(doc);
    return 'missing';
  }
  let rect = target.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > PHONE_H) {
    target.scrollIntoView({ block: 'center' });
    rect = target.getBoundingClientRect();
  }
  const point = hit.point ?? { xRatio: 0.5, yRatio: 0.5 };
  const el = overlayEl(doc);
  el.style.display = 'block';
  el.style.left = `${rect.left - 3}px`;
  el.style.top = `${rect.top - 3}px`;
  el.style.width = `${rect.width + 6}px`;
  el.style.height = `${rect.height + 6}px`;
  const dot = el.firstElementChild as HTMLElement | null;
  if (dot) {
    dot.style.left = `${3 + rect.width * point.xRatio}px`;
    dot.style.top = `${3 + rect.height * point.yRatio}px`;
  }
  return 'found';
}

/**
 * Paint one snapshot into `doc` (already a shell) and draw `hit`. `key`
 * identifies the snapshot (blob file) for parse caching.
 */
export function paintSnapshot(
  doc: Document,
  snap: { readonly key: string; readonly html: string },
  hit: ReportStepHit | null
): HitResult {
  const parsed = parseSnapshot(snap.key, snap.html);
  syncHead(doc, parsed);
  syncAttributes(doc.documentElement, parsed.htmlAttrs);
  syncAttributes(doc.body, Array.from(parsed.body.attributes));
  doc.body.replaceChildren(
    ...Array.from(parsed.body.childNodes, (n) => doc.importNode(n, true))
  );
  const scroller = doc.scrollingElement;
  if (scroller) scroller.scrollTop = 0;
  return drawHit(doc, hit);
}

/** Sandboxed (no scripts), same-origin iframe the parent paints into. */
export function createSnapshotIframe(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.className = 'sr-snap';
  // Without an explicit src the frame resolves to the report's own URL, so the
  // browser tries to load the whole (multi-MB) report into every snapshot —
  // blocked with a console warning when the report is opened over `file:`.
  frame.src = 'about:blank';
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.width = String(PHONE_W);
  frame.height = String(PHONE_H);
  frame.title = 'UI snapshot';
  frame.tabIndex = -1;
  return frame;
}

/** Shell-ready document of a mounted snapshot iframe, or null. */
export function snapshotDocument(
  frame: HTMLIFrameElement,
  frameCss: string
): Document | null {
  const doc = frame.contentDocument;
  if (!doc) return null;
  ensureShell(doc, frameCss);
  return doc;
}
