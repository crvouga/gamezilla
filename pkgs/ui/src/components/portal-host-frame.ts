/**
 * Window ↔ portal-host coordinate conversion.
 *
 * Overlay / surface-stack hosts use `absoluteFill` so they clip inside nested
 * roots (playground panels). Anchors measured with `measureInWindow` must be
 * converted into that host's local space before `position: 'absolute'` paint.
 */

import type { LayoutRectangle } from 'react-native';

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

/** Subtract host window origin from a point. */
export function subtractHostOrigin(
  x: number,
  y: number,
  host: PortalHostFrame
): { x: number; y: number } {
  return { x: x - host.x, y: y - host.y };
}

/** Convert a window-space rect into host-local space. */
export function windowRectToHostLocal(
  rect: LayoutRectangle,
  host: PortalHostFrame
): LayoutRectangle {
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
