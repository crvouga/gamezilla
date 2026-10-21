/**
 * Framework-free helpers for {@link Select}: option filtering, listbox
 * roving-focus math, and type-ahead matching.
 */

import type { SelectOption, SelectValue } from './select-types';

/** Text an option is matched against (search box + type-ahead). */
export function selectOptionText<T extends SelectValue>(
  option: SelectOption<T>
): string {
  if (option.searchText !== undefined) return option.searchText;
  if (typeof option.label === 'string') return option.label;
  if (typeof option.label === 'number') return String(option.label);
  return '';
}

/**
 * Case-insensitive `includes` on {@link selectOptionText}. Options without
 * any text always pass so custom-labelled rows never vanish.
 */
export function filterSelectOptions<T extends SelectValue>(
  options: readonly SelectOption<T>[],
  query: string
): SelectOption<T>[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...options];
  return options.filter((option) => {
    const text = selectOptionText(option);
    if (text === '') return true;
    return text.toLowerCase().includes(q);
  });
}

/**
 * Index of the option to focus after `key` in a `role="listbox"`:
 * arrows wrap, Home / End jump. `null` when the key is not a navigation key.
 */
export function nextSelectOptionIndex(args: {
  key: string;
  /** Currently focused option index, or `-1` when focus is elsewhere. */
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

/** Printable single character that should feed the type-ahead buffer. */
export function isTypeAheadKey(key: string): boolean {
  return key.length === 1 && key !== ' ';
}

/**
 * Type-ahead: first option (searching forward from `from`, wrapping) whose
 * text starts with `buffer`. With a single repeated character the search
 * starts *after* `from` so repeated presses cycle through matches.
 */
export function typeAheadIndex(
  texts: readonly string[],
  buffer: string,
  from: number
): number | null {
  const needle = buffer.toLowerCase();
  if (needle === '' || texts.length === 0) return null;
  const cycling = needle.length === 1 || /^(.)\1+$/.test(needle);
  const probe = cycling ? (needle[0] ?? '') : needle;
  const start = cycling ? from + 1 : Math.max(from, 0);
  for (let step = 0; step < texts.length; step++) {
    const index = (start + step) % texts.length;
    if (texts[index]?.toLowerCase().startsWith(probe) === true) {
      return index;
    }
  }
  return null;
}
