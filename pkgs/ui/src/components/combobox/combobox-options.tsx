import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { Box } from '../box';
import { ErrorState } from '../error-state';
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
  error,
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
  error: ReactNode | undefined;
  emptyMessage: ReactNode | undefined;
}) {
  const { t } = useLingui();
  if (loading) {
    return <LoadingState size="small" />;
  }
  const list =
    options.length === 0 ? (
      <ComboboxEmpty emptyMessage={emptyMessage} />
    ) : (
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
  if (error == null || error === '') {
    return list;
  }
  return (
    <Box sx={{ gap: 2 }}>
      <ErrorState variant="compact" title={t`Failed to load`} body={error} />
      {list}
    </Box>
  );
}
