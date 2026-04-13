import { Dimensions, type LayoutRectangle } from 'react-native';

const DEFAULT_GAP = 6;

export type FloatingMenuInsets = {
  top: number;
  bottom: number;
};

/**
 * Computes absolute top/left for a menu panel anchored to a trigger
 * (`measureInWindow`), flipping above the anchor when there is not enough
 * space below.
 */
export function computeFloatingMenuPosition(
  anchor: LayoutRectangle,
  menuHeight: number,
  insets: FloatingMenuInsets,
  menuWidth: number,
  gap: number = DEFAULT_GAP,
): { top: number; left: number } {
  const { width: screenW, height: screenH } = Dimensions.get('window');

  let top = anchor.y + anchor.height + gap;
  if (top + menuHeight > screenH - insets.bottom - 8) {
    top = anchor.y - menuHeight - gap;
  }
  top = Math.max(insets.top + 8, top);

  let left = anchor.x + anchor.width - menuWidth;
  left = Math.max(8, Math.min(left, screenW - menuWidth - 8));

  return { top, left };
}
