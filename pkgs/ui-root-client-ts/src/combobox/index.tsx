/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type {
  ComboboxProps,
  ComboboxValue,
} from '@pkgs/ui-root-shared-ts/combobox-types';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import { ComboboxBody } from '../combobox-body/index';
import { ComboboxLabel, ComboboxTrigger } from '../combobox-trigger/index';
import { ResponsiveSurface } from '../responsive-surface/index';
import { useComboboxController } from '../use-combobox-controller';

function resolveSurfaceTitle(
  surfaceTitle: JSX.Element | undefined,
  label: JSX.Element | undefined,
  fallback: string
): JSX.Element {
  if (surfaceTitle !== undefined) return surfaceTitle;
  if (label !== undefined) return label;
  return fallback;
}

function accessibleName(
  override: string | undefined,
  label: JSX.Element | undefined
): string | undefined {
  if (override !== undefined) return override;
  return typeof label === 'string' ? label : undefined;
}

/**
 * `Combobox` -- trigger row that opens a {@link ResponsiveSurface} with a
 * searchable, filterable option list (single or multiple select).
 *
 * Always presents as a centered modal: comboboxes are often nested inside
 * another surface, and a stacked modal keeps focus / Escape ownership simple.
 * The surface uses `scroll={false}` so only the option list scrolls; header
 * and search stay pinned.
 */
export function Combobox<T extends ComboboxValue = string>(
  props: ComboboxProps<T>
): JSX.Element {
  const { t } = useLingui();
  const listboxId = `combobox-listbox-${createUniqueId()}`;
  const c = useComboboxController(props);
  const name = (): string | undefined =>
    accessibleName(props['aria-label'], props.label);
  return (
    <div
      class="box"
      {...dataAttrs({ component: 'Combobox', ...props.dataSet })}
    >
      <Show when={props.label !== undefined}>
        <ComboboxLabel label={props.label} />
      </Show>
      <ComboboxTrigger
        selected={c.selectedSingle()}
        selectedOptions={c.selectedMulti()}
        multiple={c.multiple()}
        placeholder={props.placeholder ?? t`Select…`}
        disabled={props.disabled === true}
        open={c.open()}
        listboxId={listboxId}
        onOpen={c.openSurface}
        onClear={c.multiple() ? c.handleClear : undefined}
        onRemove={c.removeMultiValue}
        aria-label={name()}
        dataSet={props.triggerDataSet}
      />
      <ResponsiveSurface
        visible={c.open()}
        onClose={c.handleClose}
        title={resolveSurfaceTitle(props.surfaceTitle, props.label, t`Choose`)}
        label={name()}
        presentation="modal"
        scroll={false}
      >
        <ComboboxBody
          query={c.query()}
          setQuery={c.setQuery}
          searchPlaceholder={props.searchPlaceholder ?? t`Search…`}
          options={c.filtered()}
          value={c.singleValue()}
          values={c.selectedSet()}
          highlightedIndex={c.highlightedIndex()}
          listboxId={listboxId}
          listboxLabel={name()}
          multiple={c.multiple()}
          onPick={c.handlePick}
          onDone={c.handleClose}
          onSearchKeyDown={c.onKey}
          searchDataSet={props.searchDataSet}
          doneDataSet={props.doneDataSet}
          renderOption={props.renderOption}
          loading={props.loading === true}
          error={props.error}
          emptyMessage={props.emptyMessage}
          viewport={props.listViewport}
        />
      </ResponsiveSurface>
    </div>
  );
}
