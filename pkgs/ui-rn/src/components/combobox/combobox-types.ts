import type { LocalizedString } from '@pkgs/i18n';
import type { ReactElement, ReactNode } from 'react';

import type { ComponentDataSet } from '../../component-id';

export type ComboboxOption<T extends string | number = string> = {
  label: ReactNode;
  value: T;
  preview?: ReactNode;
  /** Used for default filter when `label` is not a string. */
  searchText?: string;
  /** DST / E2E handle on the option row press target. */
  testID?: string;
};

export type ComboboxSelectionMode = 'single' | 'multiple';

type ComboboxSharedProps<T extends string | number> = {
  options: ComboboxOption<T>[];
  /** Optional label above the trigger. */
  label?: ReactNode;
  /** Title in the surface; defaults to `label` when set, else `"Choose"`. */
  surfaceTitle?: ReactNode;
  disabled?: boolean;
  placeholder?: LocalizedString;
  searchPlaceholder?: LocalizedString;
  loading?: boolean;
  /**
   * When set (and not loading), the open surface shows a compact error above
   * the option list. Does not disable the trigger.
   */
  error?: ReactNode;
  emptyMessage?: ReactNode;
  /** Controlled query for async parents (e.g. remote user search). */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  /** DST / E2E handle on the trigger press target. */
  testID?: string;
};

export type ComboboxSingleProps<T extends string | number = string> =
  ComboboxSharedProps<T> & {
    selectionMode?: 'single';
    value?: T | null;
    onValueChange: (value: T) => void;
  };

export type ComboboxMultipleProps<T extends string | number = string> =
  ComboboxSharedProps<T> & {
    selectionMode: 'multiple';
    value?: readonly T[];
    onValueChange: (value: T[]) => void;
  };

export type ComboboxProps<T extends string | number = string> =
  | ComboboxSingleProps<T>
  | ComboboxMultipleProps<T>;

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

export function isMultipleComboboxProps<T extends string | number>(
  props: ComboboxProps<T>
): props is ComboboxMultipleProps<T> {
  return props.selectionMode === 'multiple';
}

export function toggleSelectedValue<T extends string | number>(
  current: readonly T[],
  next: T
): T[] {
  if (current.includes(next)) {
    return current.filter((v) => v !== next);
  }
  return [...current, next];
}
