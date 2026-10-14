/** @jsxImportSource solid-js */
/**
 * `ChipGroup` -- single-select horizontal row of {@link Chip} options.
 * Exposes `role="radiogroup"` with `radio` chips (`aria-checked`).
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Chip } from './chip';

export type ChipGroupOption<K extends string = string> = {
  key: K;
  label: JSX.Element;
  /** Optional leading icon node inside the chip area (caller-sized). */
  icon?: JSX.Element | undefined;
  /** Call-site id for the chip, shipped as `data-testid`. */
  testid?: string | undefined;
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
    <div
      class="box gap-2 py-1"
      {...dataAttrs({ component: 'ChipGroup', ...props.dataSet })}
    >
      <Show when={props.label !== undefined}>
        <label class="text textLabel">{props.label}</label>
      </Show>
      <div class="box flex-row flex-wrap gap-2" role="radiogroup">
        <For each={props.options}>
          {(opt) => (
            <div class="box flex-row items-center gap-1">
              {opt.icon}
              <Chip
                // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- Chip sets aria-checked from `selected` when role is radio
                role="radio"
                label={opt.label}
                selected={opt.key === props.selected}
                disabled={props.disabled}
                onClick={() => props.onSelect(opt.key)}
                dataSet={{
                  key: opt.key,
                  ...(opt.testid === undefined ? {} : { testid: opt.testid }),
                }}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
