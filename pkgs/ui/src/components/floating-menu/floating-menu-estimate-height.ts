import type { FloatingMenuContent } from './floating-menu-content';

/** Outer panel `py-2` (two sides). */
const PANEL_VERTICAL_INSET = 16;
/** Header: title, optional subtitle, padding, bottom border. */
const HEADER_BLOCK_HEIGHT = 64;
/** Header with avatar row is taller. */
const HEADER_WITH_AVATAR_BLOCK_HEIGHT = 72;
/** `FloatingMenuItem` row (`py-3` + one line). */
const ITEM_ROW_HEIGHT = 48;
/** `FloatingMenuItem` row with subtitle (`py-3` + two lines). */
const ITEM_ROW_WITH_SUBTITLE_HEIGHT = 64;
/** `FloatingMenuDivider` + vertical margin. */
const DIVIDER_ROW_HEIGHT = 10;

/**
 * Approximate menu height for flip-above / flip-below positioning.
 * @internal
 */
export function estimateFloatingMenuHeight(
  content: FloatingMenuContent
): number {
  let h = PANEL_VERTICAL_INSET;
  if (content.header !== undefined) {
    h +=
      content.header.avatar !== undefined
        ? HEADER_WITH_AVATAR_BLOCK_HEIGHT
        : HEADER_BLOCK_HEIGHT;
  }
  for (const row of content.rows) {
    if (row.type === 'divider') {
      h += DIVIDER_ROW_HEIGHT;
      continue;
    }
    h +=
      row.subtitle !== undefined
        ? ITEM_ROW_WITH_SUBTITLE_HEIGHT
        : ITEM_ROW_HEIGHT;
  }
  return h;
}
