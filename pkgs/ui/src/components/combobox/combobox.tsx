/**
 * `Combobox` — trigger row that opens a {@link ResponsiveSurface} with a
 * searchable, filterable option list (single or multiple select).
 */

import { useLingui } from '@lingui/react/macro';
import { type ReactNode, useId } from 'react';

import { componentDataSet } from '../../component-id';
import { Box } from '../box';
import { ResponsiveSurface } from '../responsive-surface';
import { ComboboxBody } from './combobox-body';
import { ComboboxLabel, ComboboxTrigger } from './combobox-trigger';
import type { ComboboxProps } from './combobox-types';
import { useComboboxController } from './use-combobox-controller';

export type {
  ComboboxMultipleProps,
  ComboboxOption,
  ComboboxProps,
  ComboboxSelectionMode,
  ComboboxSingleProps,
} from './combobox-types';

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
  const listboxId = useId();
  const c = useComboboxController(props);
  const activeDescendantId =
    c.open && c.filtered.length > 0
      ? `${listboxId}-opt-${c.highlightedIndex}`
      : undefined;

  return (
    <Box {...componentDataSet('Combobox', props.dataSet)}>
      {props.label !== undefined ? <ComboboxLabel label={props.label} /> : null}
      <ComboboxTrigger
        selected={c.selectedSingle}
        selectedOptions={c.selectedMulti}
        multiple={c.multiple}
        placeholder={props.placeholder ?? t`Select…`}
        disabled={props.disabled ?? false}
        open={c.open}
        listboxId={listboxId}
        onPress={() => {
          c.resetInternal();
          c.setOpen(true);
        }}
        onClear={c.multiple ? c.handleClear : undefined}
        onRemove={c.removeMultiValue}
      />
      <ResponsiveSurface
        visible={c.open}
        onClose={c.handleClose}
        title={resolveSurfaceTitle(props.surfaceTitle, props.label, t`Choose`)}
        // Always modal: Combobox is often nested in another surface, and
        // BottomSheetModal cannot mount from the SurfaceStack portal host
        // (outside BottomSheetModalProvider) — that throws
        // BottomSheetModalInternalContext null.
        presentation="modal"
      >
        <ComboboxBody
          query={c.query}
          setQuery={c.setQuery}
          searchPlaceholder={props.searchPlaceholder ?? t`Search…`}
          open={c.open}
          options={c.filtered}
          value={
            !c.multiple ? ((props.value as T | null | undefined) ?? null) : null
          }
          values={c.selectedSet}
          highlightedIndex={c.highlightedIndex}
          listboxId={listboxId}
          activeDescendantId={activeDescendantId}
          multiple={c.multiple}
          doneLabel={t`Done`}
          onPick={c.handlePick}
          onDone={c.handleClose}
          onSearchKeyDown={c.onKey}
          renderOption={props.renderOption}
          loading={props.loading ?? false}
          emptyMessage={props.emptyMessage}
        />
      </ResponsiveSurface>
    </Box>
  );
}
