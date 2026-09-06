import type {
  ElementLayout,
  TapPosition,
} from '@pkgs/ui-testing/driver/driver';
import { MULTI_APP_ACTOR_FRAME } from './snapshot-frame';

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
  if (measured !== null) return measured;
  const layout = provider(element) ?? synthesizeLayout(element);
  if (layout === null) {
    throw new Error('solid-dom: layout synthesis returned null');
  }
  installRect(element, layout);
  return layout;
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
