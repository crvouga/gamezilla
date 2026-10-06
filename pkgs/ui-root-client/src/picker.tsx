/** @jsxImportSource solid-js */
/**
 * `Picker` -- trigger row that opens a {@link ResponsiveSurface} with a
 * `role="listbox"` of options (single select).
 *
 * The surface uses `scroll={false}` so only the option list scrolls; the
 * title/close header stays pinned.
 *
 * Pass `loading` / `error` for async option lists -- status renders inside the
 * open surface; the trigger stays pressable unless `disabled` is set. Set
 * `searchable` to add a filter box above the options (focus lands there
 * instead of on the selected option).
 */

import { useLingui } from '@lingui/solid/macro';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { filterPickerOptions } from '@pkgs/ui-root-shared/picker-logic';
import type {
  PickerOption,
  PickerProps,
  PickerValue,
} from '@pkgs/ui-root-shared/picker-types';
import {
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onMount,
  Show,
} from 'solid-js';
import { ErrorState } from './error-state';
import { SearchIcon } from './icons';
import { LoadingState } from './loading-state';
import { PickerOptions } from './picker-options';
import { PickerLabel, PickerTrigger } from './picker-trigger';
import { ResponsiveSurface } from './responsive-surface';
import { TextInput } from './text-input';

function resolveTitle(
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

type PickerBodyProps<T extends PickerValue> = PickerProps<T> & {
  onPick: (next: T) => void;
  listboxId: string;
  listboxLabel: string | undefined;
};

function PickerSurfaceBody<T extends PickerValue>(
  props: PickerBodyProps<T>
): JSX.Element {
  const { t } = useLingui();
  const [query, setQuery] = createSignal('');
  const searchable = (): boolean => props.searchable === true;
  const visibleOptions = createMemo((): readonly PickerOption<T>[] =>
    searchable() ? filterPickerOptions(props.options, query()) : props.options
  );
  const hasError = (): boolean =>
    props.error !== undefined && props.error !== null && props.error !== '';
  return (
    <Show
      when={!props.loading}
      fallback={<LoadingState size="small" variant="compact" />}
    >
      <div class="box gap-2">
        <Show when={searchable()}>
          <TextInput
            ref={(el) => {
              // The search box owns initial focus (after the surface's trap).
              onMount(() => el.focus());
            }}
            type="search"
            value={query()}
            onChangeText={setQuery}
            placeholder={props.searchPlaceholder ?? t`Search…`}
            aria-label={props.searchPlaceholder ?? t`Search…`}
            aria-controls={props.listboxId}
            autocorrect="off"
            autocapitalize="none"
            startAdornment={<SearchIcon size={18} />}
            dataSet={{ component: 'PickerSearch' }}
          />
        </Show>
        <Show when={hasError()}>
          <ErrorState
            variant="compact"
            title={t`Failed to load`}
            body={props.error}
          />
        </Show>
        <PickerOptions
          id={props.listboxId}
          label={props.listboxLabel}
          options={visibleOptions()}
          value={props.value}
          onPick={props.onPick}
          renderOption={props.renderOption}
          focusOnMount={!searchable()}
        />
      </div>
    </Show>
  );
}

export function Picker<T extends PickerValue = string>(
  props: PickerProps<T>
): JSX.Element {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);
  const listboxId = `picker-listbox-${createUniqueId()}`;
  const selected = createMemo(() =>
    props.options.find((option) => option.value === props.value)
  );
  const title = (): JSX.Element =>
    resolveTitle(props.surfaceTitle, props.label, t`Choose`);
  const name = (): string | undefined =>
    accessibleName(props['aria-label'], props.label);
  const handlePick = (next: T): void => {
    props.onValueChange(next);
    setOpen(false);
  };
  return (
    <div class="box" {...dataAttrs({ component: 'Picker', ...props.dataSet })}>
      <Show when={props.label !== undefined}>
        <PickerLabel label={props.label} />
      </Show>
      <PickerTrigger
        selected={selected()}
        placeholder={props.placeholder ?? t`Select…`}
        disabled={props.disabled === true}
        size={props.size ?? 'md'}
        open={open()}
        onClick={() => setOpen(true)}
        aria-label={name()}
        dataSet={props.triggerDataSet}
      />
      <ResponsiveSurface
        visible={open()}
        onClose={() => setOpen(false)}
        title={title()}
        label={name()}
        scroll={false}
      >
        <Show
          when={props.surfaceExtra !== undefined && props.surfaceExtra !== null}
        >
          <div class="box mb-2">{props.surfaceExtra}</div>
        </Show>
        <PickerSurfaceBody
          {...props}
          onPick={handlePick}
          listboxId={listboxId}
          listboxLabel={name()}
        />
      </ResponsiveSurface>
    </div>
  );
}
