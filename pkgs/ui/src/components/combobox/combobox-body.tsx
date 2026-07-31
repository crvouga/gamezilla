import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';

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
  onPick,
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
  onPick: (next: T) => void;
  renderOption: ComboboxProps<T>['renderOption'];
  loading: boolean;
  emptyMessage: ReactNode | undefined;
}) {
  return (
    <>
      <ComboboxSearch
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
        autoFocus={open}
      />
      <ComboboxOptions
        options={options}
        value={value}
        onPick={onPick}
        renderOption={renderOption}
        loading={loading}
        emptyMessage={emptyMessage}
      />
    </>
  );
}
