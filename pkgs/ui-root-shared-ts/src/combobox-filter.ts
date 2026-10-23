/**
 * Framework-free option filtering for {@link Combobox}.
 */

import type {
  ComboboxFilterOption,
  ComboboxOption,
  ComboboxValue,
} from './combobox-types';

/**
 * Case-insensitive `includes` on `searchText`, else on a string `label`.
 * Options with neither always match (the parent owns filtering for them).
 */
export function defaultFilterOption<T extends ComboboxValue>(
  option: ComboboxOption<T>,
  query: string
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  if (option.searchText !== undefined) {
    return option.searchText.toLowerCase().includes(trimmed);
  }
  if (typeof option.label === 'string') {
    return option.label.toLowerCase().includes(trimmed);
  }
  return true;
}

/** Apply `filterOption` (default {@link defaultFilterOption}) to every option. */
export function filterComboboxOptions<T extends ComboboxValue>(
  options: readonly ComboboxOption<T>[],
  query: string,
  filterOption: ComboboxFilterOption<T> | undefined
): ComboboxOption<T>[] {
  const predicate = filterOption ?? defaultFilterOption;
  return options.filter((option) => predicate(option, query));
}

/** Highlight index kept in range after the option list changes. */
export function clampHighlightedIndex(prev: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(prev, 0), count - 1);
}
