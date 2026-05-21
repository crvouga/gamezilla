/**
 * `HorizontalPicker` — horizontal scrollable row of selectable cells with
 * fixed width/height and optional leading “random” tile.
 */

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, View, type ListRenderItem } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../text';

const RANDOM_KEY = '__random__';

export type HorizontalPickerRandomItem = {
  selected: boolean;
  onSelect: () => void;
  render: () => ReactNode;
};

export type HorizontalPickerProps<T> = {
  items: readonly T[];
  keyFor: (item: T) => string;
  selectedKey: string | null;
  onSelectItem: (item: T) => void;
  renderPreview: (item: T, selected: boolean) => ReactNode;
  /** Cell width in px (includes padding). */
  itemWidth: number;
  /** Total row height in px (preview + one-line label). */
  cellHeight?: number;
  /** Caption under each item preview (`numberOfLines={1}`). */
  captionFor?: (item: T) => string;
  randomItem?: HorizontalPickerRandomItem;
};

type Row<T> = { type: 'random' } | { type: 'item'; item: T };

type CellProps = {
  itemWidth: number;
  cellHeight: number;
  thumbSize: number;
  selected: boolean;
  caption: string;
  onPress: () => void;
  children: ReactNode;
};

function PickerCell({
  itemWidth,
  cellHeight,
  thumbSize,
  selected,
  caption,
  onPress,
  children,
}: CellProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: itemWidth,
          height: cellHeight,
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 2,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          borderWidth: 2,
          borderColor: selected ? theme.colors.tint : theme.colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
      <Text
        variant="caption"
        numberOfLines={1}
        style={{
          marginTop: 4,
          fontSize: 9,
          textAlign: 'center',
          width: itemWidth - 4,
          opacity: selected ? 1 : 0.75,
          fontWeight: selected ? '600' : '400',
        }}
        label={caption}
      />
    </Pressable>
  );
}

function buildRows<T>(
  items: readonly T[],
  randomItem: HorizontalPickerRandomItem | undefined
): Row<T>[] {
  const rows: Row<T>[] = [];
  if (randomItem !== undefined) rows.push({ type: 'random' });
  for (const item of items) rows.push({ type: 'item', item });
  return rows;
}

function computeSelectedIndex<T>(
  items: readonly T[],
  keyFor: (item: T) => string,
  selectedKey: string | null,
  randomItem: HorizontalPickerRandomItem | undefined
): number {
  if (randomItem?.selected === true) return 0;
  const offset = randomItem !== undefined ? 1 : 0;
  const i = items.findIndex((it) => keyFor(it) === selectedKey);
  return i >= 0 ? i + offset : 0;
}

function useScrollToSelected<T>(
  listRef: React.RefObject<FlatList<Row<T>> | null>,
  selectedIndex: number,
  dataLength: number
) {
  useEffect(() => {
    const list = listRef.current;
    if (list === null || dataLength === 0) return;
    const index = Math.min(selectedIndex, dataLength - 1);
    requestAnimationFrame(() => {
      list.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    });
  }, [listRef, selectedIndex, dataLength]);
}

type RenderItemDeps<T> = {
  itemWidth: number;
  cellHeight: number;
  thumbSize: number;
  randomItem: HorizontalPickerRandomItem | undefined;
  keyFor: (item: T) => string;
  selectedKey: string | null;
  captionFor: ((item: T) => string) | undefined;
  onSelectItem: (item: T) => void;
  renderPreview: (item: T, selected: boolean) => ReactNode;
};

function useRowRenderer<T>(deps: RenderItemDeps<T>): ListRenderItem<Row<T>> {
  const {
    itemWidth,
    cellHeight,
    thumbSize,
    randomItem,
    keyFor,
    selectedKey,
    captionFor,
    onSelectItem,
    renderPreview,
  } = deps;
  return useCallback(
    ({ item }) => {
      if (item.type === 'random') {
        const ri = randomItem;
        if (ri === undefined) return null;
        return (
          <PickerCell
            itemWidth={itemWidth}
            cellHeight={cellHeight}
            thumbSize={thumbSize}
            selected={ri.selected}
            caption="Random"
            onPress={ri.onSelect}
          >
            {ri.render()}
          </PickerCell>
        );
      }
      const k = keyFor(item.item);
      const sel = k === selectedKey;
      const cap = captionFor?.(item.item) ?? k;
      return (
        <PickerCell
          itemWidth={itemWidth}
          cellHeight={cellHeight}
          thumbSize={thumbSize}
          selected={sel}
          caption={cap}
          onPress={() => onSelectItem(item.item)}
        >
          {renderPreview(item.item, sel)}
        </PickerCell>
      );
    },
    [
      randomItem,
      itemWidth,
      cellHeight,
      thumbSize,
      keyFor,
      selectedKey,
      captionFor,
      onSelectItem,
      renderPreview,
    ]
  );
}

export function HorizontalPicker<T>({
  items,
  keyFor,
  selectedKey,
  onSelectItem,
  renderPreview,
  itemWidth,
  cellHeight: cellHeightProp,
  captionFor,
  randomItem,
}: HorizontalPickerProps<T>) {
  const listRef = useRef<FlatList<Row<T>>>(null);
  const thumbSize = Math.max(32, itemWidth - 12);
  const cellHeight = cellHeightProp ?? thumbSize + 4 + 18;
  const data = useMemo(() => buildRows(items, randomItem), [items, randomItem]);
  const selectedIndex = useMemo(
    () => computeSelectedIndex(items, keyFor, selectedKey, randomItem),
    [items, keyFor, selectedKey, randomItem]
  );

  useScrollToSelected(listRef, selectedIndex, data.length);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemWidth,
      offset: itemWidth * index,
      index,
    }),
    [itemWidth]
  );
  const renderItem = useRowRenderer({
    itemWidth,
    cellHeight,
    thumbSize,
    randomItem,
    keyFor,
    selectedKey,
    captionFor,
    onSelectItem,
    renderPreview,
  });
  const keyExtractor = useCallback(
    (row: Row<T>, index: number) => {
      if (row.type === 'random') return RANDOM_KEY;
      return keyFor(row.item) + String(index);
    },
    [keyFor]
  );

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      showsHorizontalScrollIndicator
      contentContainerStyle={{ gap: 0, paddingVertical: 4 }}
      onScrollToIndexFailed={({ index }) => {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, index * itemWidth - itemWidth),
          animated: true,
        });
      }}
    />
  );
}
