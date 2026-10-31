/** @jsxImportSource solid-js */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type {
  SelectOption,
  SelectSize,
  SelectValue,
} from '@pkgs/ui-root-shared-ts/select-types';
import { type JSX, Show } from 'solid-js';
import { ChevronDownIcon } from '../icons';

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

/**
 * Trigger row for {@link Select}: preview swatch, current label (or
 * placeholder), and a disclosure chevron, painted as a field (the
 * `TextInput` host: `outline` edge, control radius, focus ring, 44px). The
 * compact (`sm`) trigger is 32px tall but keeps a 44px hit area. Renders a
 * real `<button>` with `aria-haspopup="listbox"` / `aria-expanded`.
 */
export function SelectLabel(props: { label: JSX.Element }): JSX.Element {
  return <p class="text textCaption mb-1 text-text-secondary">{props.label}</p>;
}

function triggerClass(compact: boolean): string {
  return [
    'input inputTrigger hitTarget',
    compact ? 'min-h-8 gap-2 px-3 py-1' : 'min-h-11 gap-2 px-4 py-2',
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
          textBody: !compact(),
          'text-text': hasSelection(),
          'text-text-secondary': !hasSelection(),
        }}
      >
        {props.selected?.label ?? props.placeholder}
      </p>
      <ChevronDownIcon size={compact() ? 16 : 20} color="icon" />
    </button>
  );
}
