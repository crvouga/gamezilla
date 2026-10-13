/** @jsxImportSource solid-js */
/**
 * Option list for {@link Picker}: a `role="listbox"` of `role="option"`
 * buttons (≥44px) with `aria-selected`, arrow / Home / End roving focus and
 * single-character type-ahead. Focus lands on the selected option when the
 * list mounts (unless a search box owns focus).
 */

import { useTimers } from '@pkgs/clock-client/solid';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { colorVar } from '@pkgs/ui-root-shared/css-vars';
import {
  isTypeAheadKey,
  nextPickerOptionIndex,
  typeAheadIndex,
} from '@pkgs/ui-root-shared/picker-logic';
import type {
  PickerOption,
  PickerRenderOption,
  PickerValue,
} from '@pkgs/ui-root-shared/picker-types';
import { createSignal, Index, type JSX, onMount, Show } from 'solid-js';
import { CheckIcon } from './icons';
import { ScrollView } from './scroll-view';

/** Every option row is at least this tall (pointer target). */
export const PICKER_OPTION_MIN_HEIGHT = 44;
/** Max height of the option scroller before it scrolls internally. */
export const PICKER_OPTIONS_MAX_HEIGHT = 360;
/** Idle time after which the type-ahead buffer resets. */
export const PICKER_TYPE_AHEAD_RESET_MS = 500;

export type PickerOptionsProps<T extends PickerValue> = {
  options: readonly PickerOption<T>[];
  value: T;
  onPick: (next: T) => void;
  renderOption: PickerRenderOption<T> | undefined;
  /** Move focus to the selected (or first enabled) option on mount. */
  focusOnMount: boolean;
  /** Accessible name for the listbox. */
  label: string | undefined;
  id?: string | undefined;
};

function optionElements(host: HTMLElement): HTMLElement[] {
  return Array.from(
    host.querySelectorAll<HTMLElement>(
      '[role="option"]:not(:disabled):not([aria-disabled="true"])'
    )
  );
}

function focusedIndex(items: HTMLElement[]): number {
  return document.activeElement instanceof HTMLElement
    ? items.indexOf(document.activeElement)
    : -1;
}

/** Roving focus + type-ahead for the listbox host. */
function createListboxKeyboard(): (
  host: HTMLElement,
  ev: KeyboardEvent
) => void {
  const timers = useTimers();
  const [buffer, setBuffer] = createSignal('');
  let resetHandle: unknown;
  const scheduleReset = (): void => {
    if (resetHandle !== undefined) timers.clearTimeout(resetHandle);
    resetHandle = timers.setTimeout(() => {
      setBuffer('');
      resetHandle = undefined;
    }, PICKER_TYPE_AHEAD_RESET_MS);
  };
  return (host, ev) => {
    const items = optionElements(host);
    const current = focusedIndex(items);
    const next = nextPickerOptionIndex({
      key: ev.key,
      current,
      count: items.length,
    });
    if (next !== null) {
      ev.preventDefault();
      items[next]?.focus();
      return;
    }
    if (!isTypeAheadKey(ev.key)) return;
    const nextBuffer = buffer() + ev.key;
    setBuffer(nextBuffer);
    scheduleReset();
    const texts = items.map((el) => el.textContent);
    const match = typeAheadIndex(texts, nextBuffer, current);
    if (match !== null) {
      ev.preventDefault();
      items[match]?.focus();
    }
  };
}

function DefaultOptionRow<T extends PickerValue>(props: {
  option: PickerOption<T>;
  selected: boolean;
  onPick: () => void;
}): JSX.Element {
  const disabled = (): boolean => props.option.disabled === true;
  return (
    <button
      class="clickable clickableTint w-full flex-row items-center gap-3 py-3 px-4 text-left"
      {...dataAttrs({ component: 'PickerOption', ...props.option.dataSet })}
      type="button"
      style={{
        'background-color': props.selected
          ? colorVar('tintSubtle')
          : 'transparent',
        'min-height': `${PICKER_OPTION_MIN_HEIGHT}px`,
        opacity: disabled() ? 0.4 : 1,
      }}
      role="option"
      aria-selected={props.selected}
      disabled={disabled()}
      onClick={() => props.onPick()}
    >
      <Show when={props.option.preview !== undefined}>
        <div class="box shrink-0">{props.option.preview}</div>
      </Show>
      <p class="text line-clamp-1 flex-1 min-w-0">{props.option.label}</p>
      <Show when={props.selected}>
        <CheckIcon size={18} color="tint" />
      </Show>
    </button>
  );
}

function OptionSeparator(): JSX.Element {
  return <div class="box border-b border-border ml-4" aria-hidden="true" />;
}

/** Custom rows get the listbox semantics from a focusable shell. */
function CustomOptionRow<T extends PickerValue>(props: {
  option: PickerOption<T>;
  selected: boolean;
  onPick: () => void;
  render: PickerRenderOption<T>;
}): JSX.Element {
  return (
    <div
      class="box min-w-0"
      {...dataAttrs({ component: 'PickerOption', ...props.option.dataSet })}
      style={
        props.selected && props.option.disabled !== true
          ? { 'background-color': colorVar('tintSubtle') }
          : undefined
      }
      role="option"
      tabIndex={-1}
      aria-selected={props.selected}
      aria-disabled={props.option.disabled === true ? true : undefined}
    >
      {props.render(props.option, props.selected, props.onPick)}
    </div>
  );
}

function PickerOptionEntry<T extends PickerValue>(props: {
  option: PickerOption<T>;
  selected: boolean;
  last: boolean;
  renderOption: PickerRenderOption<T> | undefined;
  onPick: () => void;
}): JSX.Element {
  return (
    <>
      <Show
        when={props.renderOption}
        fallback={
          <DefaultOptionRow
            option={props.option}
            selected={props.selected}
            onPick={() => props.onPick()}
          />
        }
      >
        {(render) => (
          <CustomOptionRow
            option={props.option}
            selected={props.selected}
            onPick={() => props.onPick()}
            render={render()}
          />
        )}
      </Show>
      <Show when={!props.last}>
        <OptionSeparator />
      </Show>
    </>
  );
}

function focusInitial<T extends PickerValue>(
  host: HTMLElement,
  options: readonly PickerOption<T>[],
  value: T
): void {
  const items = optionElements(host);
  const selectedIndex = options
    .filter((o) => o.disabled !== true)
    .findIndex((o) => o.value === value);
  (items[selectedIndex] ?? items[0])?.focus();
}

export function PickerOptions<T extends PickerValue>(
  props: PickerOptionsProps<T>
): JSX.Element {
  let hostEl: HTMLElement | undefined;
  const onKeyDown = createListboxKeyboard();
  const pickIfEnabled = (option: PickerOption<T>): void => {
    if (option.disabled === true) return;
    props.onPick(option.value);
  };
  onMount(() => {
    if (props.focusOnMount && hostEl !== undefined) {
      focusInitial(hostEl, props.options, props.value);
    }
  });
  return (
    <ScrollView style={{ 'max-height': `${PICKER_OPTIONS_MAX_HEIGHT}px` }}>
      <div
        class="box"
        data-component="PickerOptions"
        ref={(el) => {
          hostEl = el;
        }}
        role="listbox"
        id={props.id}
        tabIndex={-1}
        aria-label={props.label}
        onKeyDown={(ev) => onKeyDown(ev.currentTarget, ev)}
      >
        {/* Rows stay by position. A press refreshes option objects before the
            click, and a new node would drop the choice. */}
        <Index each={props.options}>
          {(option, index) => (
            <PickerOptionEntry
              option={option()}
              selected={option().value === props.value}
              last={index === props.options.length - 1}
              renderOption={props.renderOption}
              onPick={() => pickIfEnabled(option())}
            />
          )}
        </Index>
      </div>
    </ScrollView>
  );
}
