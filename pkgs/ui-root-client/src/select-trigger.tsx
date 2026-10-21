/** @jsxImportSource solid-js */
/**
 * Trigger row for {@link Select}: preview swatch, current label (or
 * placeholder), and a disclosure chevron. Renders a real `<button>` with
 * `aria-haspopup="listbox"` / `aria-expanded`.
 */

import type { LocalizedString } from '@pkgs/i18n-shared/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type {
  SelectOption,
  SelectSize,
  SelectValue,
} from '@pkgs/ui-root-shared/select-types';
import { type JSX, Show } from 'solid-js';
import { ChevronDownIcon } from './icons';

export type SelectTriggerProps<T extends SelectValue> = {
  selected: SelectOption<T> | undefined;
  placeholder: LocalizedString;
  disabled: boolean;
  size: SelectSize;
  open: boolean;
  onClick: () => void;
  'aria-label': string | undefined;
  /** DOM `data-*` identifiers for the trigger button. */
  dataSet?: ComponentDataSet | undefined;
};

export function SelectLabel(props: { label: JSX.Element }): JSX.Element {
  return <p class="text textCaption mb-1 text-text-secondary">{props.label}</p>;
}

function triggerClass(compact: boolean): string {
  return [
    'clickable clickableTint flex-row items-center min-w-0 w-full text-left',
    'rounded-control border border-solid border-outline bg-surface-muted',
    'disabled:opacity-disabled',
    compact ? 'h-8 gap-2 px-2' : 'min-h-11 gap-3 px-3 py-2',
  ].join(' ');
}

export function SelectTrigger<T extends SelectValue>(
  props: SelectTriggerProps<T>
): JSX.Element {
  const compact = (): boolean => props.size === 'sm';
  const hasSelection = (): boolean => props.selected !== undefined;
  return (
    <button
      class={triggerClass(compact())}
      {...dataAttrs({ component: 'SelectTrigger', ...props.dataSet })}
      type="button"
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
        classList={{
          textFootnote: compact(),
          textLabel: !compact(),
          'text-text': hasSelection(),
          'text-text-secondary': !hasSelection(),
        }}
      >
        {props.selected?.label ?? props.placeholder}
      </p>
      <ChevronDownIcon size={compact() ? 14 : 18} color="textSecondary" />
    </button>
  );
}
