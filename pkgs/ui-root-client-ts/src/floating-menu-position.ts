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

/**
 * The preferred side and alignment. The menu keeps its side unless the
 * panel does not fit there and does fit on the other side: then it flips,
 * so a menu never covers the control that opened it.
 */
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
 * Whether the panel opens below its anchor: the preferred side when it fits
 * there or fits on neither side, else the other side.
 */
function opensBelow(
  opts: ComputeFloatingMenuPositionOptions,
  preferBelow: boolean,
  gap: number
): boolean {
  const { anchor, menuHeight, insets, viewport } = opts;
  const fitsBelow =
    anchor.y + anchor.height + gap + menuHeight <=
    viewport.height - insets.bottom - EDGE_MARGIN;
  const fitsAbove = anchor.y - gap - menuHeight >= insets.top + EDGE_MARGIN;
  return preferBelow ? fitsBelow || !fitsAbove : !fitsAbove && fitsBelow;
}

/**
 * Absolute top/left for a menu panel from its placement: on the preferred
 * side, flipped to the other side when only that one fits, then clamped
 * inside the viewport.
 */
export function computeFloatingMenuPosition(
  opts: ComputeFloatingMenuPositionOptions
): FloatingMenuPosition {
  const { anchor, menuHeight, menuWidth, insets, viewport } = opts;
  const gap = opts.gap ?? DEFAULT_GAP;
  const placement = opts.placement ?? 'bottom-end';
  const below = opensBelow(opts, placement.startsWith('bottom'), gap);
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
