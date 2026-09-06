export type ComboboxKeyEvent = {
  key: string;
  preventDefault: () => void;
};

export function handleComboboxKeyNav(args: {
  event: ComboboxKeyEvent;
  optionCount: number;
  highlightedIndex: number;
  setHighlightedIndex: (updater: (prev: number) => number) => void;
  onActivate: () => void;
  onClose: () => void;
  onBackspaceEmpty: (() => void) | undefined;
  query: string;
}): boolean {
  const { event, optionCount } = args;
  if (event.key === 'Escape') {
    event.preventDefault();
    args.onClose();
    return true;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (optionCount === 0) return true;
    args.setHighlightedIndex((prev) => (prev + 1) % optionCount);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (optionCount === 0) return true;
    args.setHighlightedIndex((prev) => (prev - 1 + optionCount) % optionCount);
    return true;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    args.setHighlightedIndex(() => 0);
    return true;
  }
  if (event.key === 'End') {
    event.preventDefault();
    if (optionCount === 0) return true;
    args.setHighlightedIndex(() => optionCount - 1);
    return true;
  }
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
