/** @jsxImportSource @solidjs/web */
import { ariaBoolean } from '@pkgs/ui-root-shared-ts/aria-boolean';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * Option list for {@link Combobox}: a windowed {@link VirtualList} exposed as
 * `role="listbox"` whose rows are `role="option"` buttons with
 * `aria-selected`. The highlighted row (keyboard) is tinted and kept in view.
 */

import { isValueSelected } from '@pkgs/ui-root-shared-ts/combobox-selection';
import type {
  ComboboxOption,
  ComboboxRenderOption,
  ComboboxValue,
} from '@pkgs/ui-root-shared-ts/combobox-types';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { VirtualListViewport } from '@pkgs/ui-root-shared-ts/virtual-list-types';
import type { JSX } from '@solidjs/web';
import { createEffect, Show, untrack } from 'solid-js';
import { CheckIcon } from '../icons';
import { VirtualList } from '../virtual-list/index';

/** Every option row is at least this tall (pointer target). */
export const COMBOBOX_OPTION_MIN_HEIGHT = 44;
/** Estimated row height handed to the virtualizer. */
export const COMBOBOX_OPTION_ESTIMATE = 50;

export function comboboxOptionId(listboxId: string, index: number): string {
  return `${listboxId}-opt-${index}`;
}

export type ComboboxListProps<T extends ComboboxValue> = {
  options: readonly ComboboxOption<T>[];
  value: T | null;
  values: ReadonlySet<T> | undefined;
  highlightedIndex: number;
  listboxId: string;
  multiple: boolean;
  label: string | undefined;
  onPick: (next: T) => void;
  renderOption: ComboboxRenderOption<T> | undefined;
  viewport: VirtualListViewport | undefined;
};

function DefaultOptionRow<T extends ComboboxValue>(props: {
  option: ComboboxOption<T>;
  selected: boolean;
  highlighted: boolean;
  id: string;
  onPick: () => void;
}): JSX.Element {
  return (
    <button
      class={[
        'clickable clickableTint w-full flex-row items-center gap-3 py-3 px-4 text-left',
        { 'bg-tint-subtle': props.highlighted },
      ]}
      {...dataAttrs({ component: 'ComboboxOption', ...props.option.dataSet })}
      type="button"
      style={{ 'min-height': cssPx(COMBOBOX_OPTION_MIN_HEIGHT) }}
      id={props.id}
      role="option"
      aria-selected={ariaBoolean(props.selected)}
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

/** Keep the highlighted row visible; falls back to estimated offsets for rows the virtualizer has not rendered. */
function scrollHighlightedIntoView(
  scroller: HTMLElement | undefined,
  rowId: string,
  index: number
): void {
  const row = document.getElementById(rowId);
  if (row !== null && typeof row.scrollIntoView === 'function') {
    row.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (scroller === undefined) return;
  scroller.scrollTop = index * COMBOBOX_OPTION_ESTIMATE;
}

/** One option: the caller's rendering inside the option host, or the default row. */
function ComboboxRow<T extends ComboboxValue>(props: {
  list: ComboboxListProps<T>;
  option: ComboboxOption<T>;
  index: number;
}): JSX.Element {
  const selected = (): boolean =>
    isValueSelected(props.list.value, props.list.values, props.option.value);
  const highlighted = (): boolean =>
    props.list.highlightedIndex === props.index;
  const id = (): string => comboboxOptionId(props.list.listboxId, props.index);
  const onPick = (): void => props.list.onPick(props.option.value);
  return (
    <Show
      when={props.list.renderOption}
      fallback={
        <DefaultOptionRow
          id={id()}
          option={props.option}
          selected={selected()}
          highlighted={highlighted()}
          onPick={onPick}
        />
      }
    >
      {(render) => (
        <div
          class={['box', { 'bg-tint-subtle': highlighted() }]}
          {...dataAttrs({
            component: 'ComboboxOption',
            ...props.option.dataSet,
          })}
          id={id()}
          role="option"
          aria-selected={ariaBoolean(selected())}
        >
          {render()(props.option, selected(), onPick)}
        </div>
      )}
    </Show>
  );
}

export function ComboboxList<T extends ComboboxValue>(
  props: ComboboxListProps<T>
): JSX.Element {
  let scroller: HTMLDivElement | undefined;
  createEffect(
    () => {
      // Only a move of the highlight scrolls; the list is read as it stands.
      const index = props.highlightedIndex;
      return untrack(() => ({
        index,
        empty: props.options.length === 0,
        rowId: comboboxOptionId(props.listboxId, index),
      }));
    },
    (highlight) => {
      if (highlight.empty) return;
      scrollHighlightedIntoView(scroller, highlight.rowId, highlight.index);
    },
    { defer: true }
  );
  const renderRow = (option: ComboboxOption<T>, index: number): JSX.Element => (
    <ComboboxRow list={props} option={option} index={index} />
  );
  return (
    <VirtualList
      ref={(el) => {
        scroller = el;
      }}
      id={props.listboxId}
      role="listbox"
      aria-label={props.label}
      aria-multiselectable={props.multiple ? true : undefined}
      items={props.options}
      keyExtractor={(option) => String(option.value)}
      renderItem={renderRow}
      estimateSize={COMBOBOX_OPTION_ESTIMATE}
      fixedViewport={props.viewport}
      grow
      maxHeight="md"
      dataSet={{ component: 'ComboboxList' }}
    />
  );
}
