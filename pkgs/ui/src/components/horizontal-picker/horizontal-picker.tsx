import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, ListRenderItem } from 'react-native';
import type Animated from 'react-native-reanimated';
import {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { HorizontalPickerCell } from './horizontal-picker-cell';
import {
  clampIndex,
  indexFromOffset,
  offsetForIndex,
  useHorizontalPickerSelection,
} from './use-horizontal-picker-selection';
import { HorizontalPickerList } from './horizontal-picker-list';
import { HorizontalPickerShell } from './horizontal-picker-shell';

const DEFAULT_ITEM_WIDTH = 120;

export type HorizontalPickerProps<T> = {
  items: readonly T[];
  selectedIndex: number;
  onSelect: (item: T, index: number) => void;
  onSettle?: (item: T, index: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
  itemWidth?: number;
  showArrows?: boolean;
  keyExtractor?: (item: T, index: number) => string;
  /**
   * FlatList re-render marker. Pass anything `renderItem` reads outside
   * `items` (e.g. avatar seed / draft options) so recycled cells refresh.
   */
  extraData?: unknown;
};

type ScrollSetup = {
  scrollX: SharedValue<number>;
  listWidth: number;
  onListLayout: (e: LayoutChangeEvent) => void;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
};

function usePickerScroll(
  clamped: number,
  itemWidth: number,
  emitSelect: (offsetX: number) => void
): ScrollSetup {
  const scrollX = useSharedValue(offsetForIndex(clamped, itemWidth));
  const lastIndexSv = useSharedValue(clamped);
  const [listWidth, setListWidth] = useState(0);
  const emitRef = useRef(emitSelect);
  emitRef.current = emitSelect;

  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setListWidth((prev) => (prev > 0 ? prev : w));
  }, []);

  const onIndexCrossed = useCallback((offsetX: number) => {
    emitRef.current(offsetX);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      const x = e.contentOffset.x;
      scrollX.value = x;
      const next = Math.round(x / itemWidth);
      if (next !== lastIndexSv.value) {
        lastIndexSv.value = next;
        runOnJS(onIndexCrossed)(x);
      }
    },
  });

  return { scrollX, listWidth, onListLayout, scrollHandler };
}

type RenderDeps<T> = {
  itemWidth: number;
  scrollX: SharedValue<number>;
  selectByIndex: (index: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
};

function useRenderListItem<T>(deps: RenderDeps<T>): ListRenderItem<T> {
  const { itemWidth, scrollX, selectByIndex, renderItem } = deps;
  return useCallback(
    ({ item, index }) => (
      <HorizontalPickerCell
        index={index}
        itemWidth={itemWidth}
        scrollX={scrollX}
        onPress={() => selectByIndex(index)}
      >
        {renderItem(item, index)}
      </HorizontalPickerCell>
    ),
    [itemWidth, scrollX, selectByIndex, renderItem]
  );
}

/**
 * `HorizontalPicker` — flat Cover Flow–style centered carousel.
 *
 * `onSelect` fires when the nearest index changes (including mid-swipe).
 * Optional `onSettle` fires once when scroll rests.
 */
export function HorizontalPicker<T>(props: HorizontalPickerProps<T>): ReactNode {
  const {
    items,
    selectedIndex,
    onSelect,
    renderItem,
    itemWidth = DEFAULT_ITEM_WIDTH,
    showArrows = true,
    keyExtractor: keyExtractorProp,
    extraData,
  } = props;
  const clamped = clampIndex(selectedIndex, items.length);
  const listRef = useRef<Animated.FlatList<T>>(null);

  const selection = useHorizontalPickerSelection({
    listRef: listRef as React.RefObject<Animated.FlatList<unknown> | null>,
    items,
    selectedIndex,
    itemWidth,
    onSelect,
    ...(props.onSettle !== undefined ? { onSettle: props.onSettle } : {}),
  });

  const { scrollX, listWidth, onListLayout, scrollHandler } = usePickerScroll(
    clamped,
    itemWidth,
    selection.emitSelect
  );

  const keyExtractor = useCallback(
    (item: T, index: number) =>
      keyExtractorProp !== undefined
        ? keyExtractorProp(item, index)
        : String(index),
    [keyExtractorProp]
  );

  const renderListItem = useRenderListItem({
    itemWidth,
    scrollX,
    selectByIndex: selection.selectByIndex,
    renderItem,
  });

  if (items.length === 0) return null;

  return (
    <HorizontalPickerShell
      showArrows={showArrows}
      clamped={clamped}
      itemCount={items.length}
      onPrev={() => selection.selectByIndex(clamped - 1)}
      onNext={() => selection.selectByIndex(clamped + 1)}
    >
      <HorizontalPickerList
        listRef={listRef}
        items={items}
        itemWidth={itemWidth}
        clampedIndex={clamped}
        listWidth={listWidth}
        renderListItem={renderListItem}
        keyExtractor={keyExtractor}
        onListLayout={onListLayout}
        scrollHandler={scrollHandler}
        onScrollEnd={selection.onScrollEnd}
        onScrollEndDrag={selection.onScrollEndDrag}
        {...(extraData !== undefined ? { extraData } : {})}
      />
    </HorizontalPickerShell>
  );
}

export { clampIndex, indexFromOffset, offsetForIndex };
