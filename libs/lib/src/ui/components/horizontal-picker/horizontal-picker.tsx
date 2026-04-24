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

type Row<T> =
  | { type: 'random' }
  | { type: 'item'; item: T };

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
  const theme = useTheme();
  const listRef = useRef<FlatList<Row<T>>>(null);

  const thumbSize = Math.max(32, itemWidth - 12);
  const cellHeight = cellHeightProp ?? thumbSize + 4 + 18;

  const data = useMemo((): Row<T>[] => {
    const rows: Row<T>[] = [];
    if (randomItem !== undefined) rows.push({ type: 'random' });
    for (const item of items) rows.push({ type: 'item', item });
    return rows;
  }, [items, randomItem]);

  const selectedIndex = useMemo(() => {
    if (randomItem?.selected === true) return 0;
    const offset = randomItem !== undefined ? 1 : 0;
    const i = items.findIndex((it) => keyFor(it) === selectedKey);
    return i >= 0 ? i + offset : 0;
  }, [items, keyFor, selectedKey, randomItem]);

  useEffect(() => {
    const list = listRef.current;
    if (list === null || data.length === 0) return;
    const index = Math.min(selectedIndex, data.length - 1);
    requestAnimationFrame(() => {
      list.scrollToIndex({
        index,
        viewPosition: 0.5,
        animated: true,
      });
    });
  }, [selectedIndex, data.length]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemWidth,
      offset: itemWidth * index,
      index,
    }),
    [itemWidth]
  );

  const renderItem: ListRenderItem<Row<T>> = useCallback(
    ({ item }) => {
      if (item.type === 'random') {
        const ri = randomItem;
        if (ri === undefined) return null;
        return (
          <Pressable
            onPress={ri.onSelect}
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
                borderColor: ri.selected
                  ? theme.colors.tint
                  : theme.colors.border,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {ri.render()}
            </View>
            <Text
              variant="caption"
              numberOfLines={1}
              style={{
                marginTop: 4,
                fontSize: 9,
                textAlign: 'center',
                width: itemWidth - 4,
                opacity: ri.selected ? 1 : 0.75,
                fontWeight: ri.selected ? '600' : '400',
              }}
              label="Random"
            />
          </Pressable>
        );
      }

      const k = keyFor(item.item);
      const sel = k === selectedKey;
      const cap = captionFor?.(item.item) ?? k;

      return (
        <Pressable
          onPress={() => onSelectItem(item.item)}
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
              borderColor: sel ? theme.colors.tint : theme.colors.border,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {renderPreview(item.item, sel)}
          </View>
          <Text
            variant="caption"
            numberOfLines={1}
            style={{
              marginTop: 4,
              fontSize: 9,
              textAlign: 'center',
              width: itemWidth - 4,
              opacity: sel ? 1 : 0.75,
              fontWeight: sel ? '600' : '400',
            }}
            label={cap}
          />
        </Pressable>
      );
    },
    [
      randomItem,
      itemWidth,
      cellHeight,
      thumbSize,
      theme.colors.tint,
      theme.colors.border,
      keyFor,
      selectedKey,
      captionFor,
      onSelectItem,
      renderPreview,
    ]
  );

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
