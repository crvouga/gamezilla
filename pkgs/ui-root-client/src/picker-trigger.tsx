/** @jsxImportSource solid-js */
/**
 * Trigger row for {@link Picker}: preview swatch, current label (or
 * placeholder), and a disclosure chevron. Renders a real `<button>` with
 * `aria-haspopup="listbox"` / `aria-expanded`.
 */

import type { LocalizedString } from '@pkgs/i18n-shared/localized-string';
import { colorVar } from '@pkgs/ui-root-shared/css-vars';
import type {
  PickerOption,
  PickerSize,
  PickerValue,
} from '@pkgs/ui-root-shared/picker-types';
import { type JSX, Show } from 'solid-js';
import { ChevronDownIcon } from './icons';

/** Minimum pointer target for the default-size trigger. */
export const PICKER_TRIGGER_MIN_HEIGHT = 44;
/** Compact trigger height (dense chrome, e.g. tab bars). */
export const PICKER_TRIGGER_COMPACT_HEIGHT = 32;

export type PickerTriggerProps<T extends PickerValue> = {
  selected: PickerOption<T> | undefined;
  placeholder: LocalizedString;
  disabled: boolean;
  size: PickerSize;
  open: boolean;
  onClick: () => void;
  'aria-label': string | undefined;
};

export function PickerLabel(props: { label: JSX.Element }): JSX.Element {
  return (
    <p class="text textCaption mb-0.5 text-text-secondary">{props.label}</p>
  );
}

function triggerClass(compact: boolean): string {
  return [
    'clickable clickableTint flex-row items-center min-w-0 w-full text-left',
    'rounded-control border border-solid border-outline bg-surface-muted',
    compact ? 'h-8 gap-1.5 px-2' : 'min-h-11 gap-2.5 px-3 py-2.5',
  ]
    .filter(Boolean)
    .join(' ');
}

export function PickerTrigger<T extends PickerValue>(
  props: PickerTriggerProps<T>
): JSX.Element {
  const compact = (): boolean => props.size === 'sm';
  const hasSelection = (): boolean => props.selected !== undefined;
  return (
    <button
      class={triggerClass(compact())}
      data-component="PickerTrigger"
      type="button"
      style={{ opacity: props.disabled ? 0.4 : 1 }}
      onClick={() => props.onClick()}
      disabled={props.disabled}
      aria-haspopup="listbox"
      aria-expanded={props.open}
      aria-label={props['aria-label']}
    >
      <Show when={props.selected?.preview !== undefined}>
        <div class="box shrink-0">{props.selected?.preview}</div>
      </Show>
      <p
        class="text line-clamp-1 flex-1 min-w-0 shrink"
        classList={{ textCaption: compact(), textLabel: !compact() }}
        style={{
          color: hasSelection() ? colorVar('text') : colorVar('textSecondary'),
          ...(compact()
            ? {
                'font-size': '12px',
                'line-height': '16px',
                'font-weight': '500',
              }
            : {}),
        }}
      >
        {props.selected?.label ?? props.placeholder}
      </p>
      <ChevronDownIcon size={compact() ? 14 : 18} color="textSecondary" />
    </button>
  );
}
