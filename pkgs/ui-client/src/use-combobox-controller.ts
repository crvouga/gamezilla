/**
 * Reactive state for {@link Combobox}: controlled / uncontrolled open and
 * query, filtered options, highlight index, and pick / clear / remove
 * handlers for both selection modes.
 */

import {
  clampHighlightedIndex,
  filterComboboxOptions,
} from '@pkgs/ui-shared/combobox-filter';
import type { ComboboxKeyEvent } from '@pkgs/ui-shared/combobox-key-nav';
import { handleComboboxKeyNav } from '@pkgs/ui-shared/combobox-key-nav';
import {
  isMultipleComboboxProps,
  removeSelectedValue,
  selectedOptionsFor,
  toggleSelectedValue,
} from '@pkgs/ui-shared/combobox-selection';
import type {
  ComboboxOption,
  ComboboxProps,
  ComboboxValue,
} from '@pkgs/ui-shared/combobox-types';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
} from 'solid-js';

export type ComboboxController<T extends ComboboxValue> = {
  multiple: Accessor<boolean>;
  open: Accessor<boolean>;
  query: Accessor<string>;
  setQuery: (query: string) => void;
  filtered: Accessor<ComboboxOption<T>[]>;
  highlightedIndex: Accessor<number>;
  multiValues: Accessor<readonly T[]>;
  singleValue: Accessor<T | null>;
  selectedSingle: Accessor<ComboboxOption<T> | undefined>;
  selectedMulti: Accessor<ComboboxOption<T>[]>;
  selectedSet: Accessor<ReadonlySet<T> | undefined>;
  /** Reset the (uncontrolled) query and open the surface. */
  openSurface: () => void;
  handleClose: () => void;
  handlePick: (next: T) => void;
  handleClear: () => void;
  removeMultiValue: (value: T) => void;
  onKey: (event: ComboboxKeyEvent) => void;
};

function createOpenState<T extends ComboboxValue>(props: ComboboxProps<T>) {
  const [internalOpen, setInternalOpen] = createSignal(false);
  const open = (): boolean => props.open ?? internalOpen();
  const setOpen = (next: boolean): void => {
    props.onOpenChange?.(next);
    if (props.open === undefined) setInternalOpen(next);
  };
  return { open, setOpen };
}

function createQueryState<T extends ComboboxValue>(props: ComboboxProps<T>) {
  const [internalQuery, setInternalQuery] = createSignal('');
  const controlled = (): boolean => props.onQueryChange !== undefined;
  const query = (): string =>
    controlled() ? (props.query ?? '') : internalQuery();
  const setQuery = (next: string): void => {
    if (controlled()) props.onQueryChange?.(next);
    else setInternalQuery(next);
  };
  const resetInternal = (): void => {
    if (!controlled()) setInternalQuery('');
  };
  return { query, setQuery, resetInternal };
}

function createHighlight(
  open: Accessor<boolean>,
  query: Accessor<string>,
  count: Accessor<number>
) {
  const [highlightedIndex, setIndex] = createSignal(0);
  createEffect(on([open, query], () => setIndex(0)));
  createEffect(
    on(count, (n) => setIndex((prev) => clampHighlightedIndex(prev, n)))
  );
  const setHighlightedIndex = (updater: (prev: number) => number): void => {
    setIndex((prev) => clampHighlightedIndex(updater(prev), count()));
  };
  return { highlightedIndex, setHighlightedIndex };
}

function createSelection<T extends ComboboxValue>(props: ComboboxProps<T>) {
  const multiple = (): boolean => isMultipleComboboxProps(props);
  const multiValues = (): readonly T[] =>
    isMultipleComboboxProps(props) ? (props.value ?? []) : [];
  const singleValue = (): T | null =>
    isMultipleComboboxProps(props) ? null : (props.value ?? null);
  const selectedMulti = createMemo(() =>
    multiple() ? selectedOptionsFor(props.options, multiValues()) : []
  );
  const selectedSet = createMemo((): ReadonlySet<T> | undefined =>
    multiple() ? new Set(multiValues()) : undefined
  );
  const selectedSingle = createMemo(() => {
    if (multiple()) return undefined;
    return props.options.find((option) => option.value === singleValue());
  });
  return {
    multiple,
    multiValues,
    singleValue,
    selectedMulti,
    selectedSet,
    selectedSingle,
  };
}

export function useComboboxController<T extends ComboboxValue>(
  props: ComboboxProps<T>
): ComboboxController<T> {
  const { open, setOpen } = createOpenState(props);
  const { query, setQuery, resetInternal } = createQueryState(props);
  const filtered = createMemo(() =>
    filterComboboxOptions(props.options, query(), props.filterOption)
  );
  const { highlightedIndex, setHighlightedIndex } = createHighlight(
    open,
    query,
    () => filtered().length
  );
  const selection = createSelection(props);

  const handleClose = (): void => {
    setOpen(false);
    resetInternal();
  };
  const openSurface = (): void => {
    resetInternal();
    setOpen(true);
  };
  const handlePick = (next: T): void => {
    if (isMultipleComboboxProps(props)) {
      props.onValueChange(toggleSelectedValue(selection.multiValues(), next));
      return;
    }
    props.onValueChange(next);
    handleClose();
  };
  const handleClear = (): void => {
    if (isMultipleComboboxProps(props)) props.onValueChange([]);
  };
  const removeMultiValue = (value: T): void => {
    if (isMultipleComboboxProps(props)) {
      props.onValueChange(removeSelectedValue(selection.multiValues(), value));
    }
  };
  const onKey = (event: ComboboxKeyEvent): void => {
    if (!open()) return;
    handleComboboxKeyNav({
      event,
      optionCount: filtered().length,
      highlightedIndex: highlightedIndex(),
      setHighlightedIndex,
      onActivate: () => {
        const option = filtered()[highlightedIndex()];
        if (option !== undefined) handlePick(option.value);
      },
      onBackspaceEmpty: () => {
        if (!selection.multiple()) return;
        const values = selection.multiValues();
        const last = values[values.length - 1];
        if (last !== undefined) removeMultiValue(last);
      },
      query: query(),
    });
  };

  return {
    ...selection,
    open,
    query,
    setQuery,
    filtered,
    highlightedIndex,
    openSurface,
    handleClose,
    handlePick,
    handleClear,
    removeMultiValue,
    onKey,
  };
}
