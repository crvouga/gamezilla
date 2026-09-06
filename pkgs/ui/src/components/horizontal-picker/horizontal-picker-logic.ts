/** Framework-free index/offset math for `HorizontalPicker`. */

export const HORIZONTAL_PICKER_DEFAULT_ITEM_WIDTH = 120;

/** Nearest item index for a scroll offset (cells are `itemWidth` wide). */
export function indexFromOffset(offsetX: number, itemWidth: number): number {
  if (itemWidth <= 0) return 0;
  return Math.round(offsetX / itemWidth);
}

/** Clamp `index` into `[0, length - 1]` (`0` for an empty list). */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

/** Scroll offset that centers `index` (with centering padding applied). */
export function offsetForIndex(index: number, itemWidth: number): number {
  return Math.max(0, index) * itemWidth;
}

/**
 * Horizontal content padding that centers the first / last cell in the
 * scrollport. Combined with `scroll-snap-align: center` this makes
 * `scrollLeft === index * itemWidth` for every snapped cell.
 */
export function centeringPadding(itemWidth: number): string {
  return `calc(50% - ${itemWidth / 2}px)`;
}

export type PickerSettle = {
  readonly index: number;
  /** `true` when `onSelect` must fire too (index not yet emitted). */
  readonly changed: boolean;
};

export type PickerScrollTracker = {
  /** Handle a `scroll` event; returns the index to emit or `null`. */
  onScroll: (offsetX: number, length: number) => number | null;
  /**
   * Handle a `scrollend` event; returns the resting index (and whether it is
   * new) or `null` when the scroll was programmatic (already emitted).
   */
  onScrollEnd: (offsetX: number, length: number) => PickerSettle | null;
  /**
   * Programmatic selection (arrows / cell tap). Returns the index to emit and
   * scroll to, or `null` when it is already selected.
   */
  select: (index: number, length: number) => number | null;
  /**
   * Parent-driven `selectedIndex` change. Returns the index the scroller must
   * animate to, or `null` when the change echoes an emitted selection or the
   * scroller already rests there.
   */
  sync: (index: number, length: number, atOffset: number) => number | null;
};

/**
 * Pure state machine behind `HorizontalPicker` emissions. Programmatic
 * scrolls (parent `selectedIndex` changes) suppress intermediate `scroll`
 * emissions until the scroller reaches the target or `scrollend` fires.
 */
export function createPickerScrollTracker(
  itemWidth: () => number,
  initialIndex: number
): PickerScrollTracker {
  let lastEmitted = initialIndex;
  let programmaticTarget: number | null = null;
  const nearest = (offsetX: number, length: number): number =>
    clampIndex(indexFromOffset(offsetX, itemWidth()), length);
  return {
    onScroll(offsetX, length) {
      const next = nearest(offsetX, length);
      if (programmaticTarget !== null) {
        if (next === programmaticTarget) programmaticTarget = null;
        return null;
      }
      if (next === lastEmitted) return null;
      lastEmitted = next;
      return next;
    },
    onScrollEnd(offsetX, length) {
      const next = nearest(offsetX, length);
      if (programmaticTarget !== null) {
        programmaticTarget = null;
        return null;
      }
      const changed = next !== lastEmitted;
      lastEmitted = next;
      return { index: next, changed };
    },
    select(index, length) {
      const next = clampIndex(index, length);
      if (next === lastEmitted) return null;
      lastEmitted = next;
      programmaticTarget = next;
      return next;
    },
    sync(index, length, atOffset) {
      const next = clampIndex(index, length);
      const echo = next === lastEmitted;
      lastEmitted = next;
      if (echo || nearest(atOffset, length) === next) return null;
      programmaticTarget = next;
      return next;
    },
  };
}
