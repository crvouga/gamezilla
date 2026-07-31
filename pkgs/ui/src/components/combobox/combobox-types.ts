import type { LocalizedString } from '@pkgs/i18n';
import type { ReactElement, ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';

export type ComboboxOption<T extends string | number = string> = {
  label: ReactNode;
  value: T;
  preview?: ReactNode;
  /** Used for default filter when `label` is not a string. */
  searchText?: string;
};

export type ComboboxProps<T extends string | number = string> = {
  options: ComboboxOption<T>[];
  onValueChange: (value: T) => void;
  /** Optional selected value for the trigger label. */
  value?: T | null;
  /** Optional label above the trigger. */
  label?: ReactNode;
  /** Title in the surface; defaults to `label` when set, else `"Choose"`. */
  surfaceTitle?: ReactNode;
  disabled?: boolean;
  placeholder?: LocalizedString;
  searchPlaceholder?: LocalizedString;
  loading?: boolean;
  emptyMessage?: ReactNode;
  /** Controlled query for async parents (e.g. remote user search). */
  query?: string;
  onQueryChange?: (query: string) => void;
  /**
   * Default: case-insensitive includes on `searchText` / string `label`.
   * Return true for every option when the parent already filters.
   */
  filterOption?: (option: ComboboxOption<T>, query: string) => boolean;
  /** Custom row renderer; default uses {@link ListItem}. */
  renderOption?: (
    option: ComboboxOption<T>,
    selected: boolean,
    onPick: () => void
  ) => ReactElement | null;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function defaultFilterOption<T extends string | number>(
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
