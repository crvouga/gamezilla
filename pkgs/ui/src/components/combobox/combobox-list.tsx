/** @jsxImportSource solid-js */
/**
 * Option list for {@link Combobox}: a windowed {@link VirtualList} exposed as
 * `role="listbox"` whose rows are `role="option"` buttons with
 * `aria-selected`. The highlighted row (keyboard) is tinted and kept in view.
 */

import { createEffect, type JSX, on, Show } from 'solid-js';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { CheckIcon } from '../icons';
import { Text } from '../text';
import { VirtualList, type VirtualListViewport } from '../virtual-list';
import { isValueSelected } from './combobox-selection';
import type {
  ComboboxOption,
  ComboboxRenderOption,
  ComboboxValue,
} from './combobox-types';

/** Every option row is at least this tall (pointer target). */
export const COMBOBOX_OPTION_MIN_HEIGHT = 44;
/** Estimated row height handed to the virtualizer. */
export const COMBOBOX_OPTION_ESTIMATE = 50;
/** Max height of the option scroller before it scrolls internally. */
export const COMBOBOX_LIST_MAX_HEIGHT = 360;

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
    <Clickable
      id={props.id}
      role="option"
      aria-selected={props.selected}
      onClick={() => props.onPick()}
      dataSet={{ component: 'ComboboxOption', ...props.option.dataSet }}
      sx={{
        width: '100%',
        minHeight: COMBOBOX_OPTION_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: 12,
        paddingHorizontal: 16,
        textAlign: 'left',
        backgroundColor: props.highlighted ? 'tintHighlight' : 'transparent',
      }}
    >
      <Show when={props.option.preview !== undefined}>
        <Box sx={{ flexShrink: 0 }}>{props.option.preview}</Box>
      </Show>
      <Text
        variant="body"
        numberOfLines={1}
        sx={{ flex: 1, minWidth: 0 }}
        label={props.option.label}
      />
      <Show when={props.selected}>
        <CheckIcon size={18} color="tint" />
      </Show>
    </Clickable>
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

export function ComboboxList<T extends ComboboxValue>(
  props: ComboboxListProps<T>
): JSX.Element {
  let scroller: HTMLDivElement | undefined;
  createEffect(
    on(
      () => props.highlightedIndex,
      (index) => {
        if (props.options.length === 0) return;
        scrollHighlightedIntoView(
          scroller,
          comboboxOptionId(props.listboxId, index),
          index
        );
      },
      { defer: true }
    )
  );
  const renderRow = (option: ComboboxOption<T>, index: number): JSX.Element => {
    const selected = isValueSelected(props.value, props.values, option.value);
    const onPick = (): void => props.onPick(option.value);
    const render = props.renderOption;
    if (render !== undefined) {
      return (
        <Box
          id={comboboxOptionId(props.listboxId, index)}
          role="option"
          aria-selected={selected}
          sx={
            props.highlightedIndex === index
              ? { backgroundColor: 'tintHighlight' }
              : undefined
          }
          dataSet={{ component: 'ComboboxOption', ...option.dataSet }}
        >
          {render(option, selected, onPick)}
        </Box>
      );
    }
    return (
      <DefaultOptionRow
        id={comboboxOptionId(props.listboxId, index)}
        option={option}
        selected={selected}
        highlighted={props.highlightedIndex === index}
        onPick={onPick}
      />
    );
  };
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
      frameSx={{ maxHeight: COMBOBOX_LIST_MAX_HEIGHT }}
      sx={{ px: 0 }}
      dataSet={{ component: 'ComboboxList' }}
    />
  );
}
