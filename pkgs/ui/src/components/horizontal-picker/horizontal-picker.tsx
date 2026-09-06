/** @jsxImportSource solid-js */
/**
 * `HorizontalPicker` -- flat Cover Flow–style centered carousel.
 *
 * A horizontal `ScrollView` with CSS scroll snapping (`x mandatory`, cells
 * snap to center); the content container carries `calc(50% - w/2)` padding so
 * every snapped cell rests at `scrollLeft === index * itemWidth`.
 *
 * `onSelect` fires whenever the nearest index changes (including mid-swipe);
 * optional `onSettle` fires once on `scrollend`. Parent `selectedIndex`
 * changes animate the scroller to the new cell.
 *
 * @example
 * ```tsx
 * <HorizontalPicker
 *   items={colors}
 *   selectedIndex={index()}
 *   onSelect={(_, i) => setIndex(i)}
 *   renderItem={(c) => <Swatch color={c} />}
 * />
 * ```
 */

import {
  createEffect,
  For,
  type JSX,
  on,
  onMount,
  Show,
  untrack,
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { ScrollView } from '../scroll-view';
import { HorizontalPickerArrow } from './horizontal-picker-arrows';
import {
  centeringPadding,
  clampIndex,
  createPickerScrollTracker,
  HORIZONTAL_PICKER_DEFAULT_ITEM_WIDTH,
  offsetForIndex,
} from './horizontal-picker-logic';

export type HorizontalPickerProps<T> = {
  items: readonly T[];
  selectedIndex: number;
  /** Fires when the nearest (centered) index changes, including mid-swipe. */
  onSelect: (item: T, index: number) => void;
  /** Fires once when the scroller rests (`scrollend`) or on tap/arrow. */
  onSettle?: ((item: T, index: number) => void) | undefined;
  renderItem: (item: T, index: number) => JSX.Element;
  /** Fixed cell width in px. Defaults to 120. */
  itemWidth?: number | undefined;
  /** Show prev/next arrow buttons. Defaults to `true`. */
  showArrows?: boolean | undefined;
  /** Stable key per item (exposed as `data-key` on the cell). */
  keyExtractor?: ((item: T, index: number) => string) | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

type ScrollBinding = {
  ref: (el: HTMLDivElement) => void;
  onScroll: () => void;
  select: (index: number) => void;
};

function usePickerScroll<T>(
  props: HorizontalPickerProps<T>,
  itemWidth: () => number
): ScrollBinding {
  let scroller: HTMLDivElement | undefined;
  const length = (): number => props.items.length;
  const tracker = createPickerScrollTracker(
    itemWidth,
    untrack(() => clampIndex(props.selectedIndex, length()))
  );
  const emit = (index: number, settle: boolean, select = true): void => {
    const item = props.items[index] as T;
    if (select) props.onSelect(item, index);
    if (settle) props.onSettle?.(item, index);
  };
  const scrollTo = (index: number, smooth: boolean): void => {
    scroller?.scrollTo({
      left: offsetForIndex(index, itemWidth()),
      behavior: smooth ? 'smooth' : 'auto',
    });
  };
  const onScrollEnd = (): void => {
    if (scroller === undefined) return;
    const settle = tracker.onScrollEnd(scroller.scrollLeft, length());
    if (settle !== null) emit(settle.index, true, settle.changed);
  };

  onMount(() => {
    if (scroller === undefined) return;
    scrollTo(clampIndex(props.selectedIndex, length()), false);
    scroller.addEventListener('scrollend', onScrollEnd);
  });
  createEffect(
    on(
      () => [props.selectedIndex, length(), itemWidth()] as const,
      ([selected, len]) => {
        if (scroller === undefined) return;
        const target = tracker.sync(selected, len, scroller.scrollLeft);
        if (target !== null) scrollTo(target, true);
      },
      { defer: true }
    )
  );

  return {
    ref: (el) => {
      scroller = el;
    },
    onScroll: () => {
      if (scroller === undefined) return;
      const index = tracker.onScroll(scroller.scrollLeft, length());
      if (index !== null) emit(index, false);
    },
    select: (index) => {
      const next = tracker.select(index, length());
      if (next === null) return;
      emit(next, true);
      scrollTo(next, true);
    },
  };
}

function PickerCell(props: {
  itemWidth: number;
  key: string;
  onClick: () => void;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Clickable
      feedback="none"
      onClick={() => props.onClick()}
      data-key={props.key}
      dataSet={{ component: 'HorizontalPickerCell' }}
      sx={{
        width: props.itemWidth,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        scrollSnapAlign: 'center',
      }}
    >
      {props.children}
    </Clickable>
  );
}

export function HorizontalPicker<T>(
  props: HorizontalPickerProps<T>
): JSX.Element {
  const itemWidth = (): number =>
    props.itemWidth ?? HORIZONTAL_PICKER_DEFAULT_ITEM_WIDTH;
  const clamped = (): number =>
    clampIndex(props.selectedIndex, props.items.length);
  const showArrows = (): boolean => props.showArrows ?? true;
  const keyOf = (item: T, index: number): string =>
    props.keyExtractor?.(item, index) ?? String(index);
  const scroll = usePickerScroll(props, itemWidth);

  return (
    <Show when={props.items.length > 0}>
      <Box
        dataSet={{ component: 'HorizontalPicker', ...props.dataSet }}
        sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
      >
        <Show when={showArrows()}>
          <HorizontalPickerArrow
            direction="prev"
            disabled={clamped() <= 0}
            onClick={() => scroll.select(clamped() - 1)}
          />
        </Show>
        <ScrollView
          ref={scroll.ref}
          horizontal
          hideScrollbar
          flushEdge={false}
          onScroll={scroll.onScroll}
          frameSx={{ flex: 1, minWidth: 0, scrollSnapType: 'x mandatory' }}
          sx={{
            paddingLeft: centeringPadding(itemWidth()),
            paddingRight: centeringPadding(itemWidth()),
          }}
          dataSet={{ component: 'HorizontalPickerScroller' }}
        >
          <For each={props.items}>
            {(item, index) => (
              <PickerCell
                itemWidth={itemWidth()}
                key={keyOf(item, index())}
                onClick={() => scroll.select(index())}
              >
                {props.renderItem(item, index())}
              </PickerCell>
            )}
          </For>
        </ScrollView>
        <Show when={showArrows()}>
          <HorizontalPickerArrow
            direction="next"
            disabled={clamped() >= props.items.length - 1}
            onClick={() => scroll.select(clamped() + 1)}
          />
        </Show>
      </Box>
    </Show>
  );
}
