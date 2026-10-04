/**
 * Framework-free keyboard reducer for the {@link Combobox} search field.
 * Escape is owned by the surrounding surface (`FocusTrap`), so it is not
 * handled here.
 */

export type ComboboxKeyEvent = {
  key: string;
  preventDefault: () => void;
};

export type ComboboxKeyNavArgs = {
  event: ComboboxKeyEvent;
  optionCount: number;
  highlightedIndex: number;
  setHighlightedIndex: (updater: (prev: number) => number) => void;
  /** Pick the highlighted option. */
  onActivate: () => void;
  /** Backspace on an empty query (multi-select removes the last chip). */
  onBackspaceEmpty: (() => void) | undefined;
  query: string;
};

function moveHighlight(args: ComboboxKeyNavArgs): boolean {
  const { event, optionCount, setHighlightedIndex } = args;
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (optionCount > 0)
        setHighlightedIndex((prev) => (prev + 1) % optionCount);
      return true;
    case 'ArrowUp':
      event.preventDefault();
      if (optionCount > 0) {
        setHighlightedIndex((prev) => (prev - 1 + optionCount) % optionCount);
      }
      return true;
    case 'Home':
      event.preventDefault();
      setHighlightedIndex(() => 0);
      return true;
    case 'End':
      event.preventDefault();
      if (optionCount > 0) setHighlightedIndex(() => optionCount - 1);
      return true;
    default:
      return false;
  }
}

/** Returns `true` when the key was consumed. */
export function handleComboboxKeyNav(args: ComboboxKeyNavArgs): boolean {
  if (moveHighlight(args)) return true;
  const { event, optionCount } = args;
  if (event.key === 'Enter') {
    if (optionCount === 0) return false;
    event.preventDefault();
    args.onActivate();
    return true;
  }
  if (
    event.key === 'Backspace' &&
    args.query.length === 0 &&
    args.onBackspaceEmpty !== undefined
  ) {
    args.onBackspaceEmpty();
    return true;
  }
  return false;
}
