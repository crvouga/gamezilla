/** @jsxImportSource @solidjs/web */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type {
  SelectOption,
  SelectRenderOption,
  SelectValue,
} from '@pkgs/ui-root-shared-ts/select-types';
import type { JSX } from '@solidjs/web';
import { Listbox, ListboxItem } from '@ui-sdk/solid/listbox';
import { For, onSettled, Show } from 'solid-js';
import { CheckIcon } from '../icons';
import { ScrollView } from '../scroll-view/index';

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

function DefaultOptionRow<T extends SelectValue>(props: {
  option: SelectOption<T>;
  selected: boolean;
  onPick: () => void;
}): JSX.Element {
  const finishCurrent = (event: Event): void => {
    if (!props.selected || props.option.disabled) return;
    event.preventDefault();
    props.onPick();
  };
  return (
    <ListboxItem
      onClick={finishCurrent}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') finishCurrent(event);
      }}
      value={props.option.value}
      disabled={props.option.disabled === true}
      render={(part) => (
        <button
          {...part}
          type="button"
          disabled={props.option.disabled === true}
        />
      )}
      class={[
        'clickable clickableTint w-full min-h-11 flex-row items-center gap-3 py-3 px-4 text-left disabled:opacity-disabled',
        { 'bg-tint-subtle': props.selected },
      ]}
      {...dataAttrs({ component: 'SelectOption', ...props.option.dataSet })}
    >
      <Show when={props.option.preview !== undefined}>
        <div class="box shrink-0">{props.option.preview}</div>
      </Show>
      <p class="text line-clamp-1 flex-1 min-w-0">{props.option.label}</p>
      <Show when={props.selected}>
        <CheckIcon size={18} color="tint" />
      </Show>
    </ListboxItem>
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
    <ListboxItem
      value={props.option.value}
      disabled={props.option.disabled === true}
      class={[
        'box min-w-0',
        {
          'bg-tint-subtle': props.selected && props.option.disabled !== true,
        },
      ]}
      {...dataAttrs({ component: 'SelectOption', ...props.option.dataSet })}
    >
      {props.render(props.option, props.selected, props.onPick)}
    </ListboxItem>
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
            onPick={props.onPick}
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
  const pickIfEnabled = (option: SelectOption<T>): void => {
    if (option.disabled === true) return;
    props.onPick(option.value);
  };
  onSettled(() => {
    if (props.focusOnMount && hostEl !== undefined) {
      focusInitial(hostEl, props.options, props.value);
    }
  });
  return (
    <ScrollView maxHeight="md">
      <Listbox<T>
        class="box"
        data-component="SelectOptions"
        ref={(el) => {
          hostEl = el;
        }}
        activation="manual"
        loop
        value={props.value}
        onValueChange={(next) => {
          if (next !== null) props.onPick(next);
        }}
        id={props.id}
        aria-label={props.label}
      >
        {/* Rows stay by position. A press refreshes option objects before the
            click, and a new node would drop the choice. */}
        <For keyed={false} each={props.options}>
          {(option, index) => (
            <SelectOptionEntry
              option={option()}
              selected={option().value === props.value}
              last={index === props.options.length - 1}
              renderOption={props.renderOption}
              onPick={() => pickIfEnabled(option())}
            />
          )}
        </For>
      </Listbox>
    </ScrollView>
  );
}
