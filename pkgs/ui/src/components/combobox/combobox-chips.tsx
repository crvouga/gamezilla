/** @jsxImportSource solid-js */
/**
 * Selected-value chips shown in the multi-select {@link Combobox} trigger.
 * Each chip is its own `<button>` (never nested inside the trigger button);
 * clicking a chip removes that value.
 */

import { For, type JSX } from 'solid-js';
import { Box } from '../box';
import { Chip } from '../chip';
import type { ComboboxOption, ComboboxValue } from './combobox-types';

export type ComboboxChipsProps<T extends ComboboxValue> = {
  selected: readonly ComboboxOption<T>[];
  onRemove: (value: T) => void;
  disabled: boolean;
};

export function ComboboxChips<T extends ComboboxValue>(
  props: ComboboxChipsProps<T>
): JSX.Element {
  return (
    <Box
      role="list"
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 1.5,
        alignItems: 'center',
        minWidth: 0,
        flexShrink: 1,
      }}
      dataSet={{ component: 'ComboboxChips' }}
    >
      <For each={props.selected}>
        {(option) => (
          <Box as="li">
            <Chip
              label={option.label}
              selected
              disabled={props.disabled}
              onClick={() => props.onRemove(option.value)}
              dataSet={{ component: 'ComboboxChip', ...option.dataSet }}
            />
          </Box>
        )}
      </For>
    </Box>
  );
}
