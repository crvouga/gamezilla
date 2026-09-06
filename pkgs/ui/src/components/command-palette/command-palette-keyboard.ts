/**
 * Framework-free selection math for the command palette list: arrows and
 * Tab / Shift+Tab wrap, Home / End jump. Escape / Enter are handled by the
 * palette itself.
 */

export type PaletteNavKey = {
  key: string;
  shiftKey: boolean;
};

/** Index to select after `key`, or `null` when the key is not navigation. */
export function nextPaletteSelection(args: {
  key: PaletteNavKey;
  current: number;
  count: number;
}): number | null {
  const { key, current, count } = args;
  if (count <= 0) return null;
  switch (key.key) {
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'Tab':
      return key.shiftKey
        ? (current - 1 + count) % count
        : (current + 1) % count;
    default:
      return null;
  }
}

/** Keep the selection inside `[0, count)` after the row set changes. */
export function clampPaletteSelection(current: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(current, 0), count - 1);
}
