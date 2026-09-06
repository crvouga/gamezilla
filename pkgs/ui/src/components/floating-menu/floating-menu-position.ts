import type { LayoutRect } from '../portal-host-frame';

const DEFAULT_GAP = 6;
/** Minimum distance from the viewport edges. */
const EDGE_MARGIN = 8;

export type FloatingMenuInsets = {
  top: number;
  bottom: number;
};

export type FloatingMenuViewport = {
  width: number;
  height: number;
};

export type ComputeFloatingMenuPositionOptions = {
  /** Anchor in host-local coordinates (see `windowRectToHostLocal`). */
  anchor: LayoutRect;
  menuHeight: number;
  menuWidth: number;
  insets: FloatingMenuInsets;
  /** Host-local viewport (surface-stack layer size), not necessarily the window. */
  viewport: FloatingMenuViewport;
  gap?: number | undefined;
};

export type FloatingMenuPosition = { top: number; left: number };

/**
 * Absolute top/left for a menu panel anchored below a trigger, right-aligned
 * to it, flipping above the anchor when there is not enough space below and
 * clamping inside the viewport.
 */
export function computeFloatingMenuPosition(
  opts: ComputeFloatingMenuPositionOptions
): FloatingMenuPosition {
  const { anchor, menuHeight, menuWidth, insets, viewport } = opts;
  const gap = opts.gap ?? DEFAULT_GAP;

  let top = anchor.y + anchor.height + gap;
  if (top + menuHeight > viewport.height - insets.bottom - EDGE_MARGIN) {
    top = anchor.y - menuHeight - gap;
  }
  top = Math.max(insets.top + EDGE_MARGIN, top);

  let left = anchor.x + anchor.width - menuWidth;
  left = Math.max(
    EDGE_MARGIN,
    Math.min(left, viewport.width - menuWidth - EDGE_MARGIN)
  );

  return { top, left };
}
