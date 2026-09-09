import type { LocalizedString } from '@pkgs/i18n/localized-string';
import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { VirtualListViewport } from '../virtual-list';

export type ComboboxValue = string | number;

export type ComboboxOption<T extends ComboboxValue = string> = {
  label: JSX.Element;
  value: T;
  preview?: JSX.Element | undefined;
  /** Used for the default filter when `label` is not a string. */
  searchText?: string | undefined;
  /** DOM `data-*` identifiers for the option row. */
  dataSet?: ComponentDataSet | undefined;
};

export type ComboboxSelectionMode = 'single' | 'multiple';

export type ComboboxRenderOption<T extends ComboboxValue> = (
  option: ComboboxOption<T>,
  selected: boolean,
  onPick: () => void
) => JSX.Element;

export type ComboboxFilterOption<T extends ComboboxValue> = (
  option: ComboboxOption<T>,
  query: string
) => boolean;

type ComboboxSharedProps<T extends ComboboxValue> = {
  options: readonly ComboboxOption<T>[];
  /** Optional label above the trigger. */
  label?: JSX.Element | undefined;
  /** Title in the surface; defaults to `label` when set, else `"Choose"`. */
  surfaceTitle?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  placeholder?: LocalizedString | undefined;
  searchPlaceholder?: LocalizedString | undefined;
  loading?: boolean | undefined;
  /**
   * When set (and not loading), the open surface shows a compact error above
   * the option list. Does not disable the trigger.
   */
  error?: JSX.Element | undefined;
  emptyMessage?: JSX.Element | undefined;
  /** Controlled query for async parents (e.g. remote user search). */
  query?: string | undefined;
  onQueryChange?: ((query: string) => void) | undefined;
  /** Controlled open state. */
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /**
   * Default: case-insensitive includes on `searchText` / string `label`.
   * Return true for every option when the parent already filters.
   */
  filterOption?: ComboboxFilterOption<T> | undefined;
  /** Custom row renderer; default renders label + preview + check mark. */
  renderOption?: ComboboxRenderOption<T> | undefined;
  /**
   * Fixed scroller size for the option {@link VirtualList} in environments
   * without layout (tests). Leave unset in the app.
   */
  listViewport?: VirtualListViewport | undefined;
  /** Accessible name for the trigger when `label` is not a plain string. */
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  /** DOM `data-*` identifiers for the trigger button. */
  triggerDataSet?: ComponentDataSet | undefined;
  /** DOM `data-*` identifiers for the surface search input. */
  searchDataSet?: ComponentDataSet | undefined;
};

export type ComboboxSingleProps<T extends ComboboxValue = string> =
  ComboboxSharedProps<T> & {
    selectionMode?: 'single' | undefined;
    value?: T | null | undefined;
    onValueChange: (value: T) => void;
  };

export type ComboboxMultipleProps<T extends ComboboxValue = string> =
  ComboboxSharedProps<T> & {
    selectionMode: 'multiple';
    value?: readonly T[] | undefined;
    onValueChange: (value: T[]) => void;
  };

export type ComboboxProps<T extends ComboboxValue = string> =
  | ComboboxSingleProps<T>
  | ComboboxMultipleProps<T>;
