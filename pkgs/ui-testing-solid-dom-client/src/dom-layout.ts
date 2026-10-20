import type {
  ElementLayout,
  TapPosition,
} from '@pkgs/ui-testing-root-shared/driver';
import { MULTI_APP_ACTOR_FRAME } from '@pkgs/ui-testing-solid-dom-shared/snapshot-frame';

/**
 * Dispatched on an element after {@link ensureElementLayout} installs a
 * synthesized `getBoundingClientRect`. Components that measure themselves
 * via ResizeObserver / an initial rect read (which stays 0 in happy-dom)
 * should re-measure on this event so probe size / fit layout can advance.
 */
export const ELEMENT_LAYOUT_EVENT = 'ui-testing:element-layout';

/**
 * Resolve an element's box when the host cannot lay out (happy-dom rects are
 * all zero). Return `null` to fall back to the built-in synthesis.
 */
export type LayoutProvider = (element: Element) => ElementLayout | null;

function rectLayout(element: Element): ElementLayout | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return null;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function parsePx(value: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (match === null) return undefined;
  const parsed = Number(match[1]);
  return parsed > 0 ? parsed : undefined;
}

/** Inline `width` / `height` in px (how `sx` sizes fixed boards). */
export function readInlineSize(
  element: Element
): { width: number; height: number } | null {
  if (!(element instanceof HTMLElement)) return null;
  const width = parsePx(element.style.width);
  const height = parsePx(element.style.height);
  if (width !== undefined && height !== undefined) return { width, height };
  if (width !== undefined) return { width, height: width };
  return null;
}

/** Default synthesis: inline px size, else a square of the actor frame width. */
export const synthesizeLayout: LayoutProvider = (element) => {
  const size = readInlineSize(element);
  const width = size?.width ?? MULTI_APP_ACTOR_FRAME.width;
  const height = size?.height ?? width;
  return { x: 0, y: 0, width, height };
};

const installedLayouts = new WeakMap<Element, ElementLayout>();

/** Publish changed geometry once, as a browser's measurement observer does. */
export function installElementLayout(
  element: Element,
  layout: ElementLayout
): void {
  const previous = installedLayouts.get(element);
  if (
    previous?.x === layout.x &&
    previous.y === layout.y &&
    previous.width === layout.width &&
    previous.height === layout.height
  )
    return;
  installedLayouts.set(element, { ...layout });
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
  const view = element.ownerDocument.defaultView;
  const EventCtor = view?.Event ?? Event;
  element.dispatchEvent(new EventCtor(ELEMENT_LAYOUT_EVENT));
}

/**
 * Ensure the element has a measurable box: a real rect when the host has
 * one, else `provider` / {@link synthesizeLayout}. The synthesized rect is
 * installed on the element so components that measure themselves
 * (`getBoundingClientRect`) see the same box the driver taps against.
 */
export function ensureElementLayout(
  element: Element,
  provider: LayoutProvider
): ElementLayout {
  const measured = rectLayout(element);
  const syn = provider(element) ?? synthesizeLayout(element);
  if (syn === null) {
    throw new Error('solid-dom: layout synthesis returned null');
  }
  const inline = readInlineSize(element);
  // Prefer explicit inline px when present (tree layout may have stubbed size).
  if (inline !== null) {
    const layout: ElementLayout = {
      x: measured?.x ?? syn.x,
      y: measured?.y ?? syn.y,
      width: inline.width,
      height: inline.height,
    };
    installElementLayout(element, layout);
    return layout;
  }
  if (measured !== null && measured.width > 0 && measured.height > 0) {
    installElementLayout(element, measured);
    return measured;
  }
  installElementLayout(element, syn);
  return syn;
}

/** Client-space point for a relative position inside `layout`. */
export function pointFromRatio(
  layout: ElementLayout,
  position: TapPosition
): { x: number; y: number } {
  return {
    x: layout.x + layout.width * position.xRatio,
    y: layout.y + layout.height * position.yRatio,
  };
}
