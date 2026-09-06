/** @jsxImportSource solid-js */
/**
 * `ChipGroup` -- single-select horizontal row of {@link Chip} options.
 * Exposes `role="radiogroup"` with `radio` chips (`aria-checked`).
 */

import { For, type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Chip } from '../chip';
import { Text } from '../text';

export type ChipGroupOption<K extends string = string> = {
  key: K;
  label: JSX.Element;
  /** Optional leading icon node inside the chip area (caller-sized). */
  icon?: JSX.Element | undefined;
};

export type ChipGroupProps<K extends string = string> = {
  options: readonly ChipGroupOption<K>[];
  selected: K;
  onSelect: (key: K) => void;
  /** Optional section label above the chips. */
  label?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function ChipGroup<K extends string = string>(
  props: ChipGroupProps<K>
): JSX.Element {
  return (
    <Box
      sx={{ gap: 2, py: 1 }}
      dataSet={{ component: 'ChipGroup', ...props.dataSet }}
    >
      <Show when={props.label !== undefined}>
        <Text variant="label" label={props.label} />
      </Show>
      <Box
        role="radiogroup"
        sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}
      >
        <For each={props.options}>
          {(opt) => (
            <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
              {opt.icon}
              <Chip
                role="radio"
                label={opt.label}
                selected={opt.key === props.selected}
                disabled={props.disabled}
                onClick={() => props.onSelect(opt.key)}
                dataSet={{ key: opt.key }}
              />
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}
