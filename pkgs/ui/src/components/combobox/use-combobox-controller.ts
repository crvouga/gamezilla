import { useCallback, useMemo, useState } from 'react';

import {
  type ComboboxKeyEvent,
  handleComboboxKeyNav,
  useComboboxHighlight,
  useComboboxWebKeydown,
} from './combobox-keyboard';
import {
  type ComboboxOption,
  type ComboboxProps,
  defaultFilterOption,
  isMultipleComboboxProps,
  toggleSelectedValue,
} from './combobox-types';

export function useComboboxQuery(
  queryProp: string | undefined,
  onQueryChange: ((query: string) => void) | undefined
) {
  const [internalQuery, setInternalQuery] = useState('');
  const controlled = onQueryChange !== undefined;
  return {
    query: controlled ? (queryProp ?? '') : internalQuery,
    setQuery: controlled ? onQueryChange : setInternalQuery,
    resetInternal: () => {
      if (!controlled) setInternalQuery('');
    },
  };
}

export function useComboboxOpen(
  openProp: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined
) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setInternalOpen(next);
  };
  return { open, setOpen };
}

function useComboboxSelection<T extends string | number>(args: {
  multiple: boolean;
  options: ComboboxOption<T>[];
  value: T | null | undefined | readonly T[];
}) {
  const multiValues = args.multiple
    ? ((args.value as readonly T[] | undefined) ?? [])
    : [];
  const selectedMulti = useMemo(() => {
    if (!args.multiple) return [];
    const set = new Set(multiValues);
    return args.options.filter((o) => set.has(o.value));
  }, [args.multiple, multiValues, args.options]);
  const selectedSet = useMemo(
    () => (args.multiple ? new Set(multiValues) : undefined),
    [args.multiple, multiValues]
  );
  const selectedSingle = !args.multiple
    ? args.options.find((o) => o.value === args.value)
    : undefined;
  return { multiValues, selectedMulti, selectedSet, selectedSingle };
}

function useComboboxPickHandlers<T extends string | number>(args: {
  multiple: boolean;
  multiValues: readonly T[];
  onValueChange: ComboboxProps<T>['onValueChange'];
  handleClose: () => void;
}) {
  const { multiple, multiValues, onValueChange, handleClose } = args;
  const handlePick = useCallback(
    (next: T) => {
      if (multiple) {
        (onValueChange as (value: T[]) => void)(
          toggleSelectedValue(multiValues, next)
        );
        return;
      }
      (onValueChange as (value: T) => void)(next);
      handleClose();
    },
    [handleClose, multiValues, multiple, onValueChange]
  );
  const handleClear = useCallback(() => {
    if (multiple) (onValueChange as (value: T[]) => void)([]);
  }, [multiple, onValueChange]);
  const removeMultiValue = useCallback(
    (value: T) => {
      if (!multiple) return;
      (onValueChange as (value: T[]) => void)(
        multiValues.filter((v) => v !== value)
      );
    },
    [multiValues, multiple, onValueChange]
  );
  return { handlePick, handleClear, removeMultiValue };
}

function useComboboxKeyHandler<T extends string | number>(args: {
  open: boolean;
  filtered: ComboboxOption<T>[];
  highlightedIndex: number;
  setHighlightedIndex: (updater: (prev: number) => number) => void;
  handlePick: (next: T) => void;
  handleClose: () => void;
  multiple: boolean;
  multiValues: readonly T[];
  removeMultiValue: (value: T) => void;
  query: string;
}) {
  const {
    open,
    filtered,
    highlightedIndex,
    setHighlightedIndex,
    handlePick,
    handleClose,
    multiple,
    multiValues,
    removeMultiValue,
    query,
  } = args;
  const onKey = useCallback(
    (event: ComboboxKeyEvent) => {
      if (!open) return;
      handleComboboxKeyNav({
        event,
        optionCount: filtered.length,
        highlightedIndex,
        setHighlightedIndex,
        onActivate: () => {
          const option = filtered[highlightedIndex];
          if (option !== undefined) handlePick(option.value);
        },
        onClose: handleClose,
        onBackspaceEmpty: multiple
          ? () => {
              const last = multiValues[multiValues.length - 1];
              if (last !== undefined) removeMultiValue(last);
            }
          : undefined,
        query,
      });
    },
    [
      open,
      filtered,
      highlightedIndex,
      setHighlightedIndex,
      handlePick,
      handleClose,
      multiple,
      multiValues,
      removeMultiValue,
      query,
    ]
  );
  useComboboxWebKeydown(open, onKey);
  return onKey;
}

export function useComboboxController<T extends string | number>(
  props: ComboboxProps<T>
) {
  const multiple = isMultipleComboboxProps(props);
  const { open, setOpen } = useComboboxOpen(props.open, props.onOpenChange);
  const { query, setQuery, resetInternal } = useComboboxQuery(
    props.query,
    props.onQueryChange
  );
  const filterOption = props.filterOption ?? defaultFilterOption;
  const filtered = useMemo(
    () => props.options.filter((option) => filterOption(option, query)),
    [props.options, filterOption, query]
  );
  const { highlightedIndex, setHighlightedIndex } = useComboboxHighlight(
    filtered.length,
    open
  );
  const selection = useComboboxSelection({
    multiple,
    options: props.options,
    value: props.value,
  });
  const handleClose = useCallback(() => {
    setOpen(false);
    resetInternal();
  }, [resetInternal, setOpen]);
  const picks = useComboboxPickHandlers({
    multiple,
    multiValues: selection.multiValues,
    onValueChange: props.onValueChange,
    handleClose,
  });
  const onKey = useComboboxKeyHandler({
    open,
    filtered,
    highlightedIndex,
    setHighlightedIndex,
    handlePick: picks.handlePick,
    handleClose,
    multiple,
    multiValues: selection.multiValues,
    removeMultiValue: picks.removeMultiValue,
    query,
  });

  return {
    multiple,
    open,
    setOpen,
    query,
    setQuery,
    resetInternal,
    filtered,
    highlightedIndex,
    selectedSingle: selection.selectedSingle,
    selectedMulti: selection.selectedMulti,
    selectedSet: selection.selectedSet,
    handleClose,
    handlePick: picks.handlePick,
    handleClear: picks.handleClear,
    removeMultiValue: picks.removeMultiValue,
    onKey,
  };
}
