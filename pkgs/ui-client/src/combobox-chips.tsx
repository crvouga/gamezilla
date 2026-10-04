/** @jsxImportSource solid-js */
/**
 * Selected-value chips shown in the multi-select {@link Combobox} trigger.
 * Each chip is its own `<button>` (never nested inside the trigger button);
 * clicking a chip removes that value.
 */

import type {
  ComboboxOption,
  ComboboxValue,
} from '@pkgs/ui-shared/combobox-types';
import { For, type JSX } from 'solid-js';
import { Chip } from './chip';

export type ComboboxChipsProps<T extends ComboboxValue> = {
  selected: readonly ComboboxOption<T>[];
  onRemove: (value: T) => void;
  disabled: boolean;
};

export function ComboboxChips<T extends ComboboxValue>(
  props: ComboboxChipsProps<T>
): JSX.Element {
  return (
    <div
      class="box flex-row flex-wrap gap-1.5 items-center min-w-0 shrink"
      data-component="ComboboxChips"
      role="list"
    >
      <For each={props.selected}>
        {(option) => (
          <li class="box">
            <Chip
              label={option.label}
              selected
              disabled={props.disabled}
              onClick={() => props.onRemove(option.value)}
              dataSet={{ component: 'ComboboxChip', ...option.dataSet }}
            />
          </li>
        )}
      </For>
    </div>
  );
}
