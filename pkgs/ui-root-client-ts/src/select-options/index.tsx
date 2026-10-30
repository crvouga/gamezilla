/** @jsxImportSource solid-js */

import { useTimers } from '@pkgs/clock-client-ts/solid';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  isTypeAheadKey,
  nextSelectOptionIndex,
  typeAheadIndex,
} from '@pkgs/ui-root-shared-ts/select-logic';
import type {
  SelectOption,
  SelectRenderOption,
  SelectValue,
} from '@pkgs/ui-root-shared-ts/select-types';
import { createSignal, Index, type JSX, onMount, Show } from 'solid-js';
import { CheckIcon } from '../icons';
import { ScrollView } from '../scroll-view/index';

/** Idle time after which the type-ahead buffer resets. */
export const SELECT_TYPE_AHEAD_RESET_MS = 500;

export type SelectOptionsProps<T extends SelectValue> = {
  options: readonly SelectOption<T>[];
  value: T;
  onPick: (next: T) => void;
  renderOption: SelectRenderOption<T> | undefined;
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
    }, SELECT_TYPE_AHEAD_RESET_MS);
  };
  return (host, ev) => {
    const items = optionElements(host);
    const current = focusedIndex(items);
    const next = nextSelectOptionIndex({
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

function DefaultOptionRow<T extends SelectValue>(props: {
  option: SelectOption<T>;
  selected: boolean;
  onPick: () => void;
}): JSX.Element {
  const disabled = (): boolean => props.option.disabled === true;
  return (
    <button
      class="clickable clickableTint w-full min-h-11 flex-row items-center gap-3 py-3 px-4 text-left disabled:opacity-disabled"
      classList={{ 'bg-tint-subtle': props.selected }}
      {...dataAttrs({ component: 'SelectOption', ...props.option.dataSet })}
      type="button"
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
function CustomOptionRow<T extends SelectValue>(props: {
  option: SelectOption<T>;
  selected: boolean;
  onPick: () => void;
  render: SelectRenderOption<T>;
}): JSX.Element {
  return (
    <div
      class="box min-w-0"
      classList={{
        'bg-tint-subtle': props.selected && props.option.disabled !== true,
      }}
      {...dataAttrs({ component: 'SelectOption', ...props.option.dataSet })}
      role="option"
      tabIndex={-1}
      aria-selected={props.selected}
      aria-disabled={props.option.disabled === true ? true : undefined}
    >
      {props.render(props.option, props.selected, props.onPick)}
    </div>
  );
}

function SelectOptionEntry<T extends SelectValue>(props: {
  option: SelectOption<T>;
  selected: boolean;
  last: boolean;
  renderOption: SelectRenderOption<T> | undefined;
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

function focusInitial<T extends SelectValue>(
  host: HTMLElement,
  options: readonly SelectOption<T>[],
  value: T
): void {
  const items = optionElements(host);
  const selectedIndex = options
    .filter((o) => o.disabled !== true)
    .findIndex((o) => o.value === value);
  (items[selectedIndex] ?? items[0])?.focus();
}

/**
 * Option list for {@link Select}: a `role="listbox"` of `role="option"`
 * buttons (≥44px) with `aria-selected`, arrow / Home / End roving focus and
 * single-character type-ahead. Focus lands on the selected option when the
 * list mounts (unless a search box owns focus).
 */
export function SelectOptions<T extends SelectValue>(
  props: SelectOptionsProps<T>
): JSX.Element {
  let hostEl: HTMLElement | undefined;
  const onKeyDown = createListboxKeyboard();
  const pickIfEnabled = (option: SelectOption<T>): void => {
    if (option.disabled === true) return;
    props.onPick(option.value);
  };
  onMount(() => {
    if (props.focusOnMount && hostEl !== undefined) {
      focusInitial(hostEl, props.options, props.value);
    }
  });
  return (
    <ScrollView maxHeight="md">
      <div
        class="box"
        data-component="SelectOptions"
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
            <SelectOptionEntry
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
