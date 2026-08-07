/**
 * `Combobox` — trigger row that opens a {@link ResponsiveSurface} with a
 * searchable, filterable option list (single select).
 */

import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { componentDataSet } from '../../component-id';
import { Box } from '../box';
import { ResponsiveSurface } from '../responsive-surface';
import { ComboboxBody } from './combobox-body';
import { ComboboxLabel, ComboboxTrigger } from './combobox-trigger';
import { type ComboboxProps, defaultFilterOption } from './combobox-types';

export type { ComboboxOption, ComboboxProps } from './combobox-types';

function useComboboxQuery(
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

function resolveSurfaceTitle(
  surfaceTitle: ReactNode | undefined,
  label: ReactNode | undefined,
  fallback: ReactNode
): ReactNode {
  if (surfaceTitle !== undefined) return surfaceTitle;
  if (label !== undefined) return label;
  return fallback;
}

export function Combobox<T extends string | number = string>(
  props: ComboboxProps<T>
) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const { query, setQuery, resetInternal } = useComboboxQuery(
    props.query,
    props.onQueryChange
  );
  const filterOption = props.filterOption ?? defaultFilterOption;
  const selected = props.options.find((o) => o.value === props.value);
  const filtered = useMemo(
    () => props.options.filter((option) => filterOption(option, query)),
    [props.options, filterOption, query]
  );
  const handleClose = () => {
    setOpen(false);
    resetInternal();
  };

  return (
    <Box {...componentDataSet('Combobox', props.dataSet)}>
      {props.label !== undefined ? <ComboboxLabel label={props.label} /> : null}
      <ComboboxTrigger
        selected={selected}
        placeholder={props.placeholder ?? t`Select…`}
        disabled={props.disabled ?? false}
        onPress={() => {
          resetInternal();
          setOpen(true);
        }}
      />
      <ResponsiveSurface
        visible={open}
        onClose={handleClose}
        title={resolveSurfaceTitle(props.surfaceTitle, props.label, t`Choose`)}
      >
        <ComboboxBody
          query={query}
          setQuery={setQuery}
          searchPlaceholder={props.searchPlaceholder ?? t`Search…`}
          open={open}
          options={filtered}
          value={props.value ?? null}
          onPick={(next) => {
            props.onValueChange(next);
            handleClose();
          }}
          renderOption={props.renderOption}
          loading={props.loading ?? false}
          emptyMessage={props.emptyMessage}
        />
      </ResponsiveSurface>
    </Box>
  );
}
