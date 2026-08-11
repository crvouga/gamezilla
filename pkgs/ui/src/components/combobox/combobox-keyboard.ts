import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { ComboboxKeyEvent } from './combobox-key-nav';

export type { ComboboxKeyEvent } from './combobox-key-nav';
export { handleComboboxKeyNav } from './combobox-key-nav';

export function useComboboxHighlight(optionCount: number, open: boolean) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(0);
      return;
    }
    setHighlightedIndex((prev) => {
      if (optionCount === 0) return 0;
      return Math.min(prev, optionCount - 1);
    });
  }, [open, optionCount]);

  return { highlightedIndex, setHighlightedIndex };
}

export function useComboboxWebKeydown(
  open: boolean,
  onKey: (event: ComboboxKeyEvent) => void
) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return undefined;
    const listener = (ev: KeyboardEvent) => {
      onKey({
        key: ev.key,
        preventDefault: () => {
          ev.preventDefault();
        },
      });
    };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [open, onKey]);
}
