/**
 * Flex-aware layout synthesis for happy-dom (all rects start at 0).
 * Walks an actor tree and installs `getBoundingClientRect` so components that
 * measure anchors (FloatingMenu, etc.) place panels under their triggers.
 */

import type { ElementLayout } from '@pkgs/ui-testing/driver/driver';
import { ELEMENT_LAYOUT_EVENT } from './dom-layout';
import { MULTI_APP_ACTOR_FRAME } from './snapshot-frame';

export type TreeLayoutFrame = {
  readonly width: number;
  readonly height: number;
};

const DEFAULT_ICON = 40;
const DEFAULT_ROW = 44;
const DEFAULT_TEXT_H = 22;

/** Known chrome sizes when inline styles are absent. */
const COMPONENT_SIZE: Record<string, { w?: number; h?: number }> = {
  ScreenBaseHeader: { h: 56 },
  AppTabBar: { h: 56 },
  AppHeaderIsland: { h: 56 },
  TopBar: { h: 56 },
  OverflowMenuButton: { w: DEFAULT_ICON, h: DEFAULT_ICON },
  IconButton: { w: DEFAULT_ICON, h: DEFAULT_ICON },
  Avatar: { w: 32, h: 32 },
  StatusDot: { w: 10, h: 10 },
  Button: { h: DEFAULT_ROW },
  AppTabButton: { h: 56 },
};

function dispatchLayoutEvent(element: Element): void {
  const view = element.ownerDocument.defaultView;
  const EventCtor = view?.Event ?? Event;
  element.dispatchEvent(new EventCtor(ELEMENT_LAYOUT_EVENT));
}

function installRect(element: Element, layout: ElementLayout): void {
  const rect: DOMRect = {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    left: layout.x,
    top: layout.y,
    right: layout.x + layout.width,
    bottom: layout.y + layout.height,
    toJSON: () => layout,
  };
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
  dispatchLayoutEvent(element);
}

function isHtml(el: Element): el is HTMLElement {
  // Avoid `instanceof HTMLElement` — happy-dom elements are from a different realm.
  // `style` may be missing until touched; `classList` is enough.
  return 'classList' in el;
}

function hasClass(el: Element, name: string): boolean {
  return isHtml(el) && el.classList.contains(name);
}

function isAbsolute(el: Element): boolean {
  if (!isHtml(el)) return false;
  if (el.classList.contains('absolute') || el.classList.contains('fixed')) {
    return true;
  }
  const pos = el.style.position;
  return pos === 'absolute' || pos === 'fixed';
}

function isContents(el: Element): boolean {
  return isHtml(el) && el.style.display === 'contents';
}

function isFlexRow(el: Element): boolean {
  return hasClass(el, 'flex-row') || hasClass(el, 'flex-row-reverse');
}

function isFlex1(el: Element): boolean {
  return hasClass(el, 'flex-1') || hasClass(el, 'flex-auto');
}

function justifyEnd(el: Element): boolean {
  return hasClass(el, 'justify-end');
}

function justifyCenter(el: Element): boolean {
  return hasClass(el, 'justify-center');
}

function justifyBetween(el: Element): boolean {
  return hasClass(el, 'justify-between');
}

function gapPx(el: Element): number {
  if (!isHtml(el)) return 0;
  for (const c of el.classList) {
    const m = /^gap-(\d+)$/.exec(c);
    if (m) return Number(m[1]) * 4;
  }
  const g = el.style.gap;
  if (g.endsWith('px')) return Number.parseFloat(g) || 0;
  return 0;
}

function parseStylePx(value: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  return n > 0 ? n : undefined;
}

function readStyleSize(el: HTMLElement): { w?: number; h?: number } {
  const out: { w?: number; h?: number } = {};
  const width = parseStylePx(el.style.width);
  const height = parseStylePx(el.style.height);
  const minH = parseStylePx(el.style.minHeight);
  const minW = parseStylePx(el.style.minWidth);
  if (width !== undefined) out.w = width;
  if (height !== undefined) out.h = height;
  if (out.h === undefined && minH !== undefined) out.h = minH;
  if (out.w === undefined && minW !== undefined) out.w = minW;
  return out;
}

function hintSize(el: Element): { w?: number; h?: number } {
  const out = isHtml(el) ? readStyleSize(el) : {};
  const component = el.getAttribute('data-component');
  if (component !== null) {
    const known = COMPONENT_SIZE[component];
    if (known) {
      if (known.w !== undefined) out.w = known.w;
      if (known.h !== undefined) out.h = known.h;
    }
  }
  if (
    out.w === undefined &&
    out.h === undefined &&
    (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')
  ) {
    out.w = DEFAULT_ICON;
    out.h = DEFAULT_ICON;
  }
  if (
    out.h === undefined &&
    (hasClass(el, 'text') || el.tagName === 'SPAN' || el.tagName === 'P')
  ) {
    out.h = DEFAULT_TEXT_H;
  }
  return out;
}

function fillsWidth(el: Element): boolean {
  return (
    hasClass(el, 'w-full') ||
    hasClass(el, 'inset-0') ||
    (isHtml(el) && el.style.width === '100%')
  );
}

function fillsHeight(el: Element): boolean {
  return (
    hasClass(el, 'h-full') ||
    hasClass(el, 'inset-0') ||
    isFlex1(el) ||
    (isHtml(el) && el.style.height === '100%')
  );
}

/** Visible element children; `display:contents` hosts are flattened. */
function flowChildren(el: Element): Element[] {
  const out: Element[] = [];
  for (const child of el.children) {
    if (!isHtml(child)) continue;
    if (child.hidden || child.getAttribute('aria-hidden') === 'true') {
      if (!isAbsolute(child)) continue;
    }
    if (isContents(child)) out.push(...flowChildren(child));
    else out.push(child);
  }
  return out;
}

function layoutAbsolute(
  el: Element,
  parent: ElementLayout,
  frame: TreeLayoutFrame
): void {
  const hint = hintSize(el);
  const width = hint.w ?? parent.width;
  const height = hint.h ?? parent.height;
  let x = parent.x;
  let y = parent.y;
  if (isHtml(el)) {
    if (el.classList.contains('inset-0')) {
      const box = {
        x: parent.x,
        y: parent.y,
        width: parent.width,
        height: parent.height,
      };
      installRect(el, box);
      layoutFlow(el, box, frame);
      return;
    }
    const top = parseStylePx(el.style.top);
    const left = parseStylePx(el.style.left);
    if (top !== undefined) y = parent.y + top;
    if (left !== undefined) x = parent.x + left;
  }
  const box = { x, y, width, height };
  installRect(el, box);
  layoutFlow(el, box, frame);
}

function distribute(
  total: number,
  fixed: readonly (number | null)[],
  gap: number
): number[] {
  const n = fixed.length;
  const gaps = Math.max(0, n - 1) * gap;
  let used = gaps;
  let flexCount = 0;
  for (const v of fixed) {
    if (v === null) flexCount += 1;
    else used += v;
  }
  const rest = Math.max(0, total - used);
  const each = flexCount > 0 ? rest / flexCount : 0;
  return fixed.map((v) => v ?? each);
}

function estimateFlowWidth(el: Element): number | null {
  if (fillsWidth(el) || isFlex1(el)) return null;
  const hint = hintSize(el);
  if (hint.w !== undefined) return hint.w;
  const kids = flowChildren(el).filter((k) => !isAbsolute(k));
  if (kids.length === 0) return 0;
  if (isFlexRow(el)) {
    const gap = gapPx(el);
    let sum = gap * Math.max(0, kids.length - 1);
    for (const kid of kids) {
      const w = estimateFlowWidth(kid);
      if (w === null) return null;
      sum += w;
    }
    return sum;
  }
  // Column / block: a fill-width child means this node stretches with its parent
  // (CSS width:auto / align-items:stretch). Treating null as 0 collapsed
  // ScreenBaseHeader → TopBar row (w-full) to 0×56 and pinned menus at x=0.
  let max = 0;
  for (const kid of kids) {
    const w = estimateFlowWidth(kid);
    if (w === null) return null;
    max = Math.max(max, w);
  }
  return max;
}

function estimateFlowHeight(el: Element): number | null {
  if (fillsHeight(el)) return null;
  const hint = hintSize(el);
  if (hint.h !== undefined) return hint.h;
  const kids = flowChildren(el).filter((k) => !isAbsolute(k));
  if (kids.length === 0) return 0;
  if (!isFlexRow(el)) {
    const gap = gapPx(el);
    let sum = gap * Math.max(0, kids.length - 1);
    for (const kid of kids) {
      const h = estimateFlowHeight(kid);
      if (h === null) return null;
      sum += h;
    }
    return sum;
  }
  let max = 0;
  for (const kid of kids) {
    max = Math.max(max, estimateFlowHeight(kid) ?? hintSize(kid).h ?? 0);
  }
  return max;
}

function layoutRow(
  el: Element,
  box: ElementLayout,
  kids: readonly Element[],
  frame: TreeLayoutFrame
): void {
  const gap = gapPx(el);
  const flow = kids.filter((k) => !isAbsolute(k));
  const abs = kids.filter((k) => isAbsolute(k));
  const widths = distribute(
    box.width,
    flow.map((k) => estimateFlowWidth(k)),
    gap
  );
  const gaps = Math.max(0, flow.length - 1) * gap;
  const used = widths.reduce((a, b) => a + b, 0) + gaps;
  let x = box.x;
  if (justifyEnd(el)) x = box.x + Math.max(0, box.width - used);
  else if (justifyCenter(el)) x = box.x + Math.max(0, (box.width - used) / 2);
  else if (justifyBetween(el) && flow.length > 1) {
    const free = Math.max(0, box.width - widths.reduce((a, b) => a + b, 0));
    const between = free / (flow.length - 1);
    flow.forEach((child, i) => {
      const w = widths[i] ?? box.width;
      const h = estimateFlowHeight(child) ?? hintSize(child).h ?? box.height;
      const y = box.y + Math.max(0, (box.height - h) / 2);
      const childBox = { x, y, width: w, height: h };
      installRect(child, childBox);
      layoutFlow(child, childBox, frame);
      x += w + between;
    });
    for (const child of abs) layoutAbsolute(child, box, frame);
    return;
  }
  flow.forEach((child, i) => {
    const w = widths[i] ?? box.width;
    const h = estimateFlowHeight(child) ?? hintSize(child).h ?? box.height;
    const y = box.y + Math.max(0, (box.height - h) / 2);
    const childBox = { x, y, width: w, height: h };
    installRect(child, childBox);
    layoutFlow(child, childBox, frame);
    x += w + gap;
  });
  for (const child of abs) layoutAbsolute(child, box, frame);
}

function layoutColumn(
  el: Element,
  box: ElementLayout,
  kids: readonly Element[],
  frame: TreeLayoutFrame
): void {
  const gap = gapPx(el);
  const flow = kids.filter((k) => !isAbsolute(k));
  const abs = kids.filter((k) => isAbsolute(k));
  const heights = distribute(
    box.height,
    flow.map((k) => estimateFlowHeight(k)),
    gap
  );
  let y = box.y;
  flow.forEach((child, i) => {
    const h = heights[i] ?? 0;
    // Default flex column stretch: fill parent width unless the child has a
    // concrete intrinsic width (and is not marked to grow/fill).
    const hintW = estimateFlowWidth(child);
    const w = hintW === null ? box.width : Math.min(hintW, box.width);
    const childBox = {
      x: box.x,
      y,
      width: w > 0 ? w : box.width,
      height: Math.max(0, h),
    };
    installRect(child, childBox);
    layoutFlow(child, childBox, frame);
    y += h + gap;
  });
  for (const child of abs) layoutAbsolute(child, box, frame);
}

function layoutFlow(
  el: Element,
  box: ElementLayout,
  frame: TreeLayoutFrame
): void {
  const kids = flowChildren(el);
  if (kids.length === 0) return;
  if (isFlexRow(el)) layoutRow(el, box, kids, frame);
  else layoutColumn(el, box, kids, frame);
}

/**
 * Assign synthesized boxes under `root` (typically the actor container).
 * Safe to call repeatedly; overwrites prior installed rects.
 */
export function layoutDomTree(
  root: HTMLElement,
  frame: TreeLayoutFrame = MULTI_APP_ACTOR_FRAME
): void {
  const box: ElementLayout = {
    x: 0,
    y: 0,
    width: frame.width,
    height: frame.height,
  };
  installRect(root, box);
  layoutFlow(root, box, frame);
}
