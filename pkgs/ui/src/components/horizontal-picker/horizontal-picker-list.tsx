import type { ReactNode, RefObject } from 'react';
import { useCallback } from 'react';
import type {
  LayoutChangeEvent,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Box } from '../box';

function sidePadding(listWidth: number, itemWidth: number): number {
  return Math.max(0, (listWidth - itemWidth) / 2);
}

export type HorizontalPickerListProps<T> = {
  listRef: RefObject<Animated.FlatList<T> | null>;
  items: readonly T[];
  itemWidth: number;
  clampedIndex: number;
  listWidth: number;
  renderListItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  onListLayout: (e: LayoutChangeEvent) => void;
  scrollHandler: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** FlatList re-render marker for renderItem deps outside `data`. */
  extraData?: unknown;
};

export function HorizontalPickerList<T>({
  listRef,
  items,
  itemWidth,
  clampedIndex,
  listWidth,
  renderListItem,
  keyExtractor,
  onListLayout,
  scrollHandler,
  onScrollEnd,
  onScrollEndDrag,
  extraData,
}: HorizontalPickerListProps<T>): ReactNode {
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemWidth,
      offset: itemWidth * index,
      index,
    }),
    [itemWidth]
  );

  const pad = listWidth > 0 ? sidePadding(listWidth, itemWidth) : 0;

  return (
    <Box sx={{ flex: 1 }}>
      <Animated.FlatList
        ref={listRef}
        horizontal
        data={items as T[]}
        keyExtractor={keyExtractor}
        renderItem={renderListItem}
        extraData={extraData}
        getItemLayout={getItemLayout}
        initialScrollIndex={clampedIndex}
        showsHorizontalScrollIndicator={false}
        onLayout={onListLayout}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        snapToInterval={itemWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        windowSize={5}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        initialNumToRender={7}
        removeClippedSubviews
        contentContainerStyle={{ paddingHorizontal: pad }}
        style={{ flex: 1 }}
      />
    </Box>
  );
}
