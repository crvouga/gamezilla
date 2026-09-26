/** @jsxImportSource solid-js */
import { cssPx } from '../../css/css-px';
/**
 * Field row for {@link Combobox}: selected chips (multi), the opener button
 * (`role="combobox"`, `aria-expanded`, `aria-controls`), and a clear
 * control for multi-select. Every interactive part is a sibling `<button>`.
 */

import { useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n/localized-string';
import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { IconButton } from '../icon-button';
import { ChevronDownIcon, XIcon } from '../icons';
import { ComboboxChips } from './combobox-chips';
import type { ComboboxOption, ComboboxValue } from './combobox-types';

/** Minimum pointer target for the opener button. */
export const COMBOBOX_TRIGGER_MIN_HEIGHT = 44;

export function ComboboxLabel(props: { label: JSX.Element }): JSX.Element {
  return (
    <p class="text textCaption mb-0.5 text-text-secondary">{props.label}</p>
  );
}

export type ComboboxTriggerProps<T extends ComboboxValue> = {
  selected: ComboboxOption<T> | undefined;
  selectedOptions: readonly ComboboxOption<T>[];
  multiple: boolean;
  placeholder: LocalizedString;
  disabled: boolean;
  open: boolean;
  listboxId: string;
  onOpen: () => void;
  /** Multi-select only: clear every value. */
  onClear: (() => void) | undefined;
  onRemove: (value: T) => void;
  'aria-label': string | undefined;
  dataSet: ComponentDataSet | undefined;
};

function SingleSummary<T extends ComboboxValue>(props: {
  selected: ComboboxOption<T> | undefined;
  placeholder: LocalizedString;
}): JSX.Element {
  return (
    <>
      <Show when={props.selected?.preview !== undefined}>
        <div class="box shrink-0">{props.selected?.preview}</div>
      </Show>
      <label
        class="text textLabel line-clamp-1 flex-1 min-w-0"
        classList={{
          'text-text': props.selected !== undefined,
          'text-text-secondary': props.selected === undefined,
        }}
      >
        {props.selected?.label ?? props.placeholder}
      </label>
    </>
  );
}

export function ComboboxTrigger<T extends ComboboxValue>(
  props: ComboboxTriggerProps<T>
): JSX.Element {
  const { t } = useLingui();
  const hasChips = (): boolean =>
    props.multiple && props.selectedOptions.length > 0;
  const showClear = (): boolean => props.onClear !== undefined && hasChips();
  return (
    <div
      class="box flex-row items-center gap-2 rounded-control border border-outline bg-surface-muted"
      data-component="ComboboxField"
      style={{
        'padding-left': cssPx(hasChips() ? 8 : 0),
        opacity: props.disabled ? 0.4 : 1,
      }}
    >
      <Show when={hasChips()}>
        <ComboboxChips
          selected={props.selectedOptions}
          onRemove={props.onRemove}
          disabled={props.disabled}
        />
      </Show>
      <button
        class="clickable clickableTint flex-1 min-w-0 flex-row items-center gap-2.5 px-3 py-2.5 rounded-control text-left"
        {...dataAttrs({ component: 'ComboboxTrigger', ...props.dataSet })}
        type="button"
        style={{ 'min-height': cssPx(COMBOBOX_TRIGGER_MIN_HEIGHT) }}
        role="combobox"
        aria-expanded={props.open}
        aria-controls={props.listboxId}
        aria-haspopup="listbox"
        aria-label={props['aria-label']}
        disabled={props.disabled}
        onClick={() => props.onOpen()}
      >
        <Show
          when={props.multiple}
          fallback={
            <SingleSummary
              selected={props.selected}
              placeholder={props.placeholder}
            />
          }
        >
          <label class="text textLabel line-clamp-1 flex-1 min-w-0 text-text-secondary">
            {hasChips() ? t`Add…` : props.placeholder}
          </label>
        </Show>
        <ChevronDownIcon size={18} color="textSecondary" />
      </button>
      <Show when={showClear()}>
        <div class="box pr-1">
          <IconButton
            label={t`Clear`}
            size={32}
            tooltip="none"
            disabled={props.disabled}
            onClick={() => props.onClear?.()}
            dataSet={{ component: 'ComboboxClear' }}
          >
            <XIcon size={16} color="textSecondary" />
          </IconButton>
        </div>
      </Show>
    </div>
  );
}
