/**
 * Window-space frame of a portal host plus a Solid signal that tracks it via
 * `ResizeObserver` (falls back to a one-shot measure when unavailable).
 */

import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

export type PortalHostFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const ZERO_PORTAL_HOST_FRAME: PortalHostFrame = Object.freeze({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
});

export type LayoutRect = PortalHostFrame;

export function subtractHostOrigin(
  x: number,
  y: number,
  host: PortalHostFrame
): { x: number; y: number } {
  return { x: x - host.x, y: y - host.y };
}

export function windowRectToHostLocal(
  rect: LayoutRect,
  host: PortalHostFrame
): LayoutRect {
  return {
    x: rect.x - host.x,
    y: rect.y - host.y,
    width: rect.width,
    height: rect.height,
  };
}

export function portalHostFramesEqual(
  a: PortalHostFrame,
  b: PortalHostFrame
): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

export function measureHostFrame(el: Element): PortalHostFrame {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/** Reactive window frame of `host()`; `ZERO_PORTAL_HOST_FRAME` until mounted. */
export function createHostFrame(
  host: Accessor<HTMLElement | undefined>
): Accessor<PortalHostFrame> {
  const [frame, setFrame] = createSignal<PortalHostFrame>(
    ZERO_PORTAL_HOST_FRAME,
    { equals: portalHostFramesEqual }
  );
  createEffect(() => {
    const el = host();
    if (el === undefined) return;
    const measure = () => setFrame(measureHostFrame(el));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });
  return frame;
}
