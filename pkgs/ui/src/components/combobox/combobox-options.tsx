import type { ReactNode } from 'react';

import { LoadingState } from '../loading-state';
import { ComboboxEmpty, ComboboxOptionsList } from './combobox-option-row';
import type { ComboboxOption, ComboboxProps } from './combobox-types';

export function ComboboxOptions<T extends string | number>({
  options,
  value,
  values,
  highlightedIndex,
  listboxId,
  onPick,
  renderOption,
  loading,
  emptyMessage,
}: {
  options: ComboboxOption<T>[];
  value: T | null | undefined;
  values: ReadonlySet<T> | undefined;
  highlightedIndex: number;
  listboxId: string;
  onPick: (next: T) => void;
  renderOption: ComboboxProps<T>['renderOption'];
  loading: boolean;
  emptyMessage: ReactNode | undefined;
}) {
  if (loading) {
    return <LoadingState size="small" />;
  }
  if (options.length === 0) {
    return <ComboboxEmpty emptyMessage={emptyMessage} />;
  }
  return (
    <ComboboxOptionsList
      options={options}
      value={value}
      values={values}
      highlightedIndex={highlightedIndex}
      listboxId={listboxId}
      onPick={onPick}
      renderOption={renderOption}
    />
  );
}
