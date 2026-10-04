import type { LayoutRect } from './portal-host-frame';

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

/** Placement is authoritative — no auto-flip. */
export type FloatingMenuPlacement =
  | 'bottom-end'
  | 'bottom-start'
  | 'top-end'
  | 'top-start';

export type ComputeFloatingMenuPositionOptions = {
  /** Anchor in host-local coordinates (see `windowRectToHostLocal`). */
  anchor: LayoutRect;
  menuHeight: number;
  menuWidth: number;
  insets: FloatingMenuInsets;
  /** Host-local viewport (surface-stack layer size), not necessarily the window. */
  viewport: FloatingMenuViewport;
  /** Defaults to `bottom-end`. */
  placement?: FloatingMenuPlacement | undefined;
  gap?: number | undefined;
};

export type FloatingMenuPosition = { top: number; left: number };

/**
 * Absolute top/left for a menu panel from a static placement prop.
 * Clamps inside the viewport; does not flip when space is short.
 */
export function computeFloatingMenuPosition(
  opts: ComputeFloatingMenuPositionOptions
): FloatingMenuPosition {
  const { anchor, menuHeight, menuWidth, insets, viewport } = opts;
  const gap = opts.gap ?? DEFAULT_GAP;
  const placement = opts.placement ?? 'bottom-end';
  const below = placement.startsWith('bottom');
  const alignEnd = placement.endsWith('end');

  let top = below
    ? anchor.y + anchor.height + gap
    : anchor.y - menuHeight - gap;
  const minTop = insets.top + EDGE_MARGIN;
  const maxTop = viewport.height - insets.bottom - EDGE_MARGIN - menuHeight;
  top = Math.max(minTop, Math.min(top, Math.max(minTop, maxTop)));

  let left = alignEnd ? anchor.x + anchor.width - menuWidth : anchor.x;
  left = Math.max(
    EDGE_MARGIN,
    Math.min(left, viewport.width - menuWidth - EDGE_MARGIN)
  );

  return { top, left };
}
