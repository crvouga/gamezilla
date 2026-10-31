/** @jsxImportSource solid-js */

import type {
  ComboboxOption,
  ComboboxValue,
} from '@pkgs/ui-root-shared-ts/combobox-types';
import { For, type JSX } from 'solid-js';
import { Chip } from '../chip/index';

export type ComboboxChipsProps<T extends ComboboxValue> = {
  selected: readonly ComboboxOption<T>[];
  onRemove: (value: T) => void;
  disabled: boolean;
};

/**
 * Selected-value chips shown in the multi-select {@link Combobox} trigger.
 * Each chip is its own `<button>` (never nested inside the trigger button);
 * clicking a chip removes that value.
 */
export function ComboboxChips<T extends ComboboxValue>(
  props: ComboboxChipsProps<T>
): JSX.Element {
  return (
    <div
      class="box flex-row flex-wrap gap-2 items-center min-w-0 shrink"
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
