/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  nextRovingIndex,
  rovingTabStop,
} from '@pkgs/ui-root-shared-ts/roving-focus';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
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

/** Arrow keys move the chosen radio chip, wrapping over disabled ones. */
function onRadioChipKeyDown(event: KeyboardEvent): void {
  const chip = event.currentTarget;
  if (!(chip instanceof HTMLElement)) return;
  const row = chip.closest('[role="radiogroup"]');
  if (row === null) return;
  const items = Array.from(
    row.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  );
  const current = items.findIndex((item) => item === document.activeElement);
  if (current < 0) return;
  const next = nextRovingIndex({
    key: event.key,
    current,
    disabled: items.map((item) => item.disabled),
    orientation: 'both',
    homeEnd: false,
  });
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
  items[next]?.click();
}

function SingleChips<K extends string>(props: {
  group: ChipGroupSingleProps<K>;
}): JSX.Element {
  const off = (option: ChipGroupOption<K>): boolean =>
    props.group.disabled === true || option.disabled === true;
  const tabStop = (): K | undefined => {
    const options = props.group.options;
    const index = rovingTabStop(
      options.findIndex((option) => option.key === props.group.selected),
      options.map(off)
    );
    return index === null ? undefined : options[index]?.key;
  };
  return (
    <For each={props.group.options}>
      {(option) => (
        <Chip
          // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- Chip sets aria-checked from `selected` when role is radio
          role="radio"
          label={option.label}
          startIcon={option.icon}
          selected={option.key === props.group.selected}
          disabled={off(option)}
          tabStop={tabStop() === option.key}
          onKeyDown={onRadioChipKeyDown}
          onClick={() => {
            if (option.key !== props.group.selected) {
              props.group.onSelect(option.key);
            }
          }}
          dataSet={optionDataSet(option)}
        />
      )}
    </For>
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
  const multiple = (): boolean => isMultiple(props);
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
      <div
        class="box flex-row flex-wrap gap-2"
        role={multiple() ? 'group' : 'radiogroup'}
        aria-label={props['aria-label']}
        aria-labelledby={
          props.label !== undefined && props['aria-label'] === undefined
            ? labelId
            : undefined
        }
        aria-disabled={props.disabled === true ? true : undefined}
      >
        <Show
          when={isMultiple(props) ? props : undefined}
          fallback={<SingleChips group={props as ChipGroupSingleProps<K>} />}
        >
          {(group) => <MultipleChips group={group()} />}
        </Show>
      </div>
    </div>
  );
}
