import type { FloatingMenuContent } from './floating-menu-content';

/** Outer panel `py-2` (two sides). */
const PANEL_VERTICAL_INSET = 16;
/** Header: title, optional subtitle, padding, bottom border. */
const HEADER_BLOCK_HEIGHT = 64;
/** `FloatingMenuItem` row (`py-3` + one line). */
const ITEM_ROW_HEIGHT = 48;
/** `FloatingMenuDivider` + vertical margin. */
const DIVIDER_ROW_HEIGHT = 10;

/**
 * Approximate menu height for flip-above / flip-below positioning.
 * @internal
 */
export function estimateFloatingMenuHeight(
  content: FloatingMenuContent
): number {
  let h = PANEL_VERTICAL_INSET + HEADER_BLOCK_HEIGHT;
  for (const row of content.rows) {
    h += row.type === 'divider' ? DIVIDER_ROW_HEIGHT : ITEM_ROW_HEIGHT;
  }
  return h;
}
