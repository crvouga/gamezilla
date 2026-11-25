/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Radio, RadioGroup } from '@ui-sdk/solid/radio';
import { createUniqueId, For, Show } from 'solid-js';
import { CHIP_CLASS, ChipFace } from '../chip/face';
import { Chip } from '../chip/index';

export type ChipGroupOption<K extends string = string> = {
  key: K;
  label: JSX.Element;
  /** Optional leading icon inside the chip (caller-sized, 16px). */
  icon?: JSX.Element | undefined;
  /** Disable this option only. */
  disabled?: boolean | undefined;
  /** Call-site id for the chip, shipped as `data-testid`. */
  testid?: string | undefined;
};

type ChipGroupCommonProps<K extends string> = {
  options: readonly ChipGroupOption<K>[];
  /** Section label above the chips; also names the group. */
  label?: JSX.Element | undefined;
  /** Names the group when there is no visible `label`. */
  'aria-label'?: string | undefined;
  /** Disable every option. */
  disabled?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export type ChipGroupSingleProps<K extends string = string> =
  ChipGroupCommonProps<K> & {
    selection?: 'single' | undefined;
    selected: K;
    onSelect: (key: K) => void;
  };

export type ChipGroupMultipleProps<K extends string = string> =
  ChipGroupCommonProps<K> & {
    selection: 'multiple';
    selected: readonly K[];
    /** The new chosen keys, in option order. */
    onSelect: (keys: readonly K[]) => void;
  };

export type ChipGroupProps<K extends string = string> =
  | ChipGroupSingleProps<K>
  | ChipGroupMultipleProps<K>;

/** `selected` with `key` toggled, in option order (pure). */
export function toggleChipKey<K extends string>(
  options: readonly ChipGroupOption<K>[],
  selected: readonly K[],
  key: K
): readonly K[] {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return options.map((option) => option.key).filter((k) => next.has(k));
}

function optionDataSet<K extends string>(
  option: ChipGroupOption<K>
): ComponentDataSet {
  return {
    key: option.key,
    ...(option.testid === undefined ? {} : { testid: option.testid }),
  };
}

function SingleChips<K extends string>(props: {
  group: ChipGroupSingleProps<K>;
  labelledBy: string | undefined;
}): JSX.Element {
  return (
    <RadioGroup
      class="box flex-row flex-wrap gap-2"
      aria-label={props.group['aria-label']}
      aria-labelledby={props.labelledBy}
      value={props.group.selected}
      disabled={props.group.disabled === true}
      onValueChange={(value) => {
        const item = props.group.options.find((option) => option.key === value);
        if (
          item &&
          !item.disabled &&
          !props.group.disabled &&
          item.key !== props.group.selected
        )
          props.group.onSelect(item.key);
      }}
    >
      <For each={props.group.options}>
        {(option) => (
          <Radio
            value={option.key}
            disabled={option.disabled === true}
            class={CHIP_CLASS}
            {...dataAttrs({ component: 'Chip', ...optionDataSet(option) })}
            render={(part, state) => (
              <button
                {...part}
                disabled={state.disabled}
                tabindex={
                  state.disabled || part['tabindex'] === '-1' ? -1 : undefined
                }
              />
            )}
          >
            <ChipFace label={option.label} startIcon={option.icon} />
          </Radio>
        )}
      </For>
    </RadioGroup>
  );
}

function MultipleChips<K extends string>(props: {
  group: ChipGroupMultipleProps<K>;
}): JSX.Element {
  return (
    <For each={props.group.options}>
      {(option) => (
        <Chip
          label={option.label}
          startIcon={option.icon}
          selected={props.group.selected.includes(option.key)}
          disabled={props.group.disabled === true || option.disabled === true}
          onClick={() =>
            props.group.onSelect(
              toggleChipKey(
                props.group.options,
                props.group.selected,
                option.key
              )
            )
          }
          dataSet={optionDataSet(option)}
        />
      )}
    </For>
  );
}

function isMultiple<K extends string>(
  group: ChipGroupProps<K>
): group is ChipGroupMultipleProps<K> {
  return group.selection === 'multiple';
}

/**
 * `ChipGroup` -- a wrapping row of {@link Chip} choices, single or multiple.
 *
 * - `selection="single"` (default): one option is chosen. The row is a
 *   `radiogroup` of `radio` chips (`aria-checked`) with one tab stop (the
 *   chosen chip); the arrow keys move to the next or previous enabled chip,
 *   wrapping, and choose it.
 * - `selection="multiple"`: any number are chosen. The row is a `group` of
 *   toggle chips (`aria-pressed`), each its own tab stop; `onSelect`
 *   receives the new set of keys in option order.
 *
 * Either way the chosen state is announced, never carried by color alone.
 * Name the group with `label` (shown above it as the section label) or
 * `aria-label`.
 *
 * @example
 * ```tsx
 * <ChipGroup label={t`Clock`} options={clocks} selected={clock()} onSelect={setClock} />
 * <ChipGroup selection="multiple" label={t`Games`} options={games} selected={picked()} onSelect={setPicked} />
 * ```
 */
export function ChipGroup<K extends string = string>(
  props: ChipGroupProps<K>
): JSX.Element {
  const labelId = `chip-group-label-${createUniqueId()}`;
  const labelledBy = () =>
    props.label !== undefined && props['aria-label'] === undefined
      ? labelId
      : undefined;
  return (
    <div
      class="box gap-2 py-1"
      {...dataAttrs({
        component: 'ChipGroup',
        selection: props.selection ?? 'single',
        ...props.dataSet,
      })}
    >
      <Show when={props.label !== undefined}>
        <span class="text textSectionLabel" id={labelId}>
          {props.label}
        </span>
      </Show>
      <Show
        when={isMultiple(props) ? props : undefined}
        fallback={
          <SingleChips
            group={props as ChipGroupSingleProps<K>}
            labelledBy={labelledBy()}
          />
        }
      >
        {(group) => (
          <div
            class="box flex-row flex-wrap gap-2"
            role="group"
            aria-label={props['aria-label']}
            aria-labelledby={labelledBy()}
            aria-disabled={props.disabled === true ? 'true' : undefined}
          >
            <MultipleChips group={group()} />
          </div>
        )}
      </Show>
    </div>
  );
}
