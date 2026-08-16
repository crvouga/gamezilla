import type { LayoutRectangle } from 'react-native';

const DEFAULT_GAP = 6;

export type FloatingMenuInsets = {
  top: number;
  bottom: number;
};

export type FloatingMenuViewport = {
  width: number;
  height: number;
};

export type ComputeFloatingMenuPositionOptions = {
  anchor: LayoutRectangle;
  menuHeight: number;
  menuWidth: number;
  insets: FloatingMenuInsets;
  /** Host-local viewport (portal panel size), not necessarily the window. */
  viewport: FloatingMenuViewport;
  gap?: number;
};

/**
 * Computes absolute top/left for a menu panel anchored to a trigger in
 * host-local coordinates (already converted from `measureInWindow`), flipping
 * above the anchor when there is not enough space below.
 */
export function computeFloatingMenuPosition({
  anchor,
  menuHeight,
  menuWidth,
  insets,
  viewport,
  gap = DEFAULT_GAP,
}: ComputeFloatingMenuPositionOptions): { top: number; left: number } {
  const { width: screenW, height: screenH } = viewport;

  let top = anchor.y + anchor.height + gap;
  if (top + menuHeight > screenH - insets.bottom - 8) {
    top = anchor.y - menuHeight - gap;
  }
  top = Math.max(insets.top + 8, top);

  let left = anchor.x + anchor.width - menuWidth;
  left = Math.max(8, Math.min(left, screenW - menuWidth - 8));

  return { top, left };
}
