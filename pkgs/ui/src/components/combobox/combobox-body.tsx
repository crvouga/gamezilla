import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

import { Box } from '../box';
import { ModalButton } from '../modal/modal-button';
import { ModalFooter } from '../modal/modal-footer';
import type { ComboboxKeyEvent } from './combobox-keyboard';
import { ComboboxOptions } from './combobox-options';
import { ComboboxSearch } from './combobox-search';
import type { ComboboxOption, ComboboxProps } from './combobox-types';

export function ComboboxBody<T extends string | number>({
  query,
  setQuery,
  searchPlaceholder,
  open,
  options,
  value,
  values,
  highlightedIndex,
  listboxId,
  activeDescendantId,
  multiple,
  doneLabel,
  onPick,
  onDone,
  onSearchKeyDown,
  renderOption,
  loading,
  emptyMessage,
}: {
  query: string;
  setQuery: (query: string) => void;
  searchPlaceholder: LocalizedString;
  open: boolean;
  options: ComboboxOption<T>[];
  value: T | null;
  values: ReadonlySet<T> | undefined;
  highlightedIndex: number;
  listboxId: string;
  activeDescendantId: string | undefined;
  multiple: boolean;
  doneLabel: LocalizedString;
  onPick: (next: T) => void;
  onDone: () => void;
  onSearchKeyDown: ((event: ComboboxKeyEvent) => void) | undefined;
  renderOption: ComboboxProps<T>['renderOption'];
  loading: boolean;
  emptyMessage: ReactNode | undefined;
}) {
  return (
    <Box sx={{ gap: 2 }}>
      <ComboboxSearch
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
        autoFocus={open}
        activeDescendantId={activeDescendantId}
        onKeyDown={onSearchKeyDown}
      />
      <ComboboxOptions
        options={options}
        value={value}
        values={values}
        highlightedIndex={highlightedIndex}
        listboxId={listboxId}
        onPick={onPick}
        renderOption={renderOption}
        loading={loading}
        emptyMessage={emptyMessage}
      />
      {multiple ? (
        <ModalFooter>
          <ModalButton label={doneLabel} onPress={onDone} />
        </ModalFooter>
      ) : null}
    </Box>
  );
}
