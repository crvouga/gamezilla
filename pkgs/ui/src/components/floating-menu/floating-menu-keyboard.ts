/**
 * Roving-focus math for `role="menu"` keyboard navigation (WAI-ARIA menu
 * pattern): arrows wrap, Home / End jump. Framework-free.
 */

/** Index of the menu item to focus after `key`, or `null` when unhandled. */
export function nextMenuItemIndex(args: {
  key: string;
  /** Index of the currently focused item, or `-1` when focus is elsewhere. */
  current: number;
  count: number;
}): number | null {
  const { key, current, count } = args;
  if (count <= 0) return null;
  const last = count - 1;
  switch (key) {
    case 'ArrowDown':
      return current < 0 || current >= last ? 0 : current + 1;
    case 'ArrowUp':
      return current <= 0 ? last : current - 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}
