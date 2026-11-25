/** @jsxImportSource @solidjs/web */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { filterSelectOptions } from '@pkgs/ui-root-shared-ts/select-logic';
import type {
  SelectOption,
  SelectProps,
  SelectValue,
} from '@pkgs/ui-root-shared-ts/select-types';
import type { JSX } from '@solidjs/web';
import {
  createMemo,
  createSignal,
  createUniqueId,
  onSettled,
  Show,
} from 'solid-js';
import { ErrorState } from '../error-state/index';
import { SearchIcon } from '../icons';
import { LoadingState } from '../loading-state/index';
import { pickerItems, SelectParts } from '../picker-parts';
import { ResponsiveSurface } from '../responsive-surface/index';
import { SelectOptions } from '../select-options/index';
import { SelectLabel, SelectTrigger } from '../select-trigger/index';
import { TextInput } from '../text-input/index';

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

type SelectBodyProps<T extends SelectValue> = SelectProps<T> & {
  onPick: (next: T) => void;
  listboxId: string;
  listboxLabel: string | undefined;
};

/** The filter box above the options; it takes focus when it appears. */
function SelectSearch(props: {
  query: string;
  onQuery: (next: string) => void;
  label: LocalizedString;
  listboxId: string;
}): JSX.Element {
  let input: HTMLInputElement | undefined;
  // The search box owns initial focus (after the surface's trap).
  onSettled(() => {
    input?.focus();
  });
  return (
    <TextInput
      ref={(el) => {
        input = el;
      }}
      type="search"
      value={props.query}
      onChangeText={(next) => props.onQuery(next)}
      placeholder={props.label}
      aria-label={props.label}
      aria-controls={props.listboxId}
      autocorrect="off"
      autocapitalize="none"
      startAdornment={<SearchIcon size={18} />}
      dataSet={{ component: 'SelectSearch' }}
    />
  );
}

function SelectSurfaceBody<T extends SelectValue>(
  props: SelectBodyProps<T>
): JSX.Element {
  const { t } = useLingui();
  const [query, setQuery] = createSignal('');
  const searchable = (): boolean => props.searchable === true;
  const visibleOptions = createMemo((): readonly SelectOption<T>[] =>
    searchable() ? filterSelectOptions(props.options, query()) : props.options
  );
  const hasError = (): boolean =>
    props.error !== undefined && props.error !== null && props.error !== '';
  return (
    <Show
      when={!props.loading}
      fallback={<LoadingState size="sm" variant="compact" />}
    >
      <div class="box gap-2">
        <Show when={searchable()}>
          <SelectSearch
            query={query()}
            onQuery={setQuery}
            label={props.searchPlaceholder ?? t`Search…`}
            listboxId={props.listboxId}
          />
        </Show>
        <Show when={hasError()}>
          <ErrorState
            variant="compact"
            title={t`Failed to load`}
            body={props.error}
          />
        </Show>
        <SelectOptions
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

/**
 * `Select` -- the one single-choice control: a labelled trigger row showing
 * the current option, which opens a {@link ResponsiveSurface} with a
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
export function Select<T extends SelectValue = string>(
  props: SelectProps<T>
): JSX.Element {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);
  const listboxId = `select-listbox-${createUniqueId()}`;
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
    <SelectParts.Root<T>
      items={pickerItems(props.options, props.loading === true)}
      disabled={props.disabled === true}
      value={props.value}
      open={open()}
      onOpenChange={(next) => setOpen(next)}
      onValueChange={(value) => {
        if (
          value !== null &&
          !props.loading &&
          !props.disabled &&
          props.options.some(
            (option) => option.value === value && !option.disabled
          )
        )
          handlePick(value);
      }}
    >
      <div
        class="box"
        {...dataAttrs({ component: 'Select', ...props.dataSet })}
      >
        <Show when={props.label !== undefined}>
          <SelectLabel label={props.label} />
        </Show>
        <SelectTrigger
          selected={selected()}
          placeholder={props.placeholder ?? t`Select…`}
          disabled={props.disabled === true}
          size={props.size ?? 'md'}
          open={open()}
          listboxId={listboxId}
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
            when={
              props.surfaceExtra !== undefined && props.surfaceExtra !== null
            }
          >
            <div class="box mb-2">{props.surfaceExtra}</div>
          </Show>
          <SelectSurfaceBody
            {...props}
            onPick={handlePick}
            listboxId={listboxId}
            listboxLabel={name()}
          />
        </ResponsiveSurface>
      </div>
    </SelectParts.Root>
  );
}
