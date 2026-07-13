import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type Animated from 'react-native-reanimated';

export function indexFromOffset(offsetX: number, itemWidth: number): number {
  if (itemWidth <= 0) return 0;
  return Math.round(offsetX / itemWidth);
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

export function offsetForIndex(index: number, itemWidth: number): number {
  return Math.max(0, index) * itemWidth;
}

type ListRef = React.RefObject<Animated.FlatList<unknown> | null>;

type EmitRefs<T> = {
  programmaticRef: React.MutableRefObject<boolean>;
  skipScrollEffectRef: React.MutableRefObject<boolean>;
  lastEmittedRef: React.MutableRefObject<number>;
  itemsRef: React.MutableRefObject<readonly T[]>;
  onSelectRef: React.MutableRefObject<(item: T, index: number) => void>;
  onSettleRef: React.MutableRefObject<
    ((item: T, index: number) => void) | undefined
  >;
  itemWidth: number;
};

function makeEmitSelect<T>(refs: EmitRefs<T>) {
  const {
    programmaticRef,
    skipScrollEffectRef,
    lastEmittedRef,
    itemsRef,
    onSelectRef,
    itemWidth,
  } = refs;
  return (offsetX: number) => {
    const list = itemsRef.current;
    if (list.length === 0) return;
    const next = clampIndex(indexFromOffset(offsetX, itemWidth), list.length);
    if (programmaticRef.current) {
      if (next === lastEmittedRef.current) return;
      programmaticRef.current = false;
    }
    if (next === lastEmittedRef.current) return;
    lastEmittedRef.current = next;
    skipScrollEffectRef.current = true;
    onSelectRef.current(list[next] as T, next);
  };
}

function makeEmitSettle<T>(refs: EmitRefs<T>) {
  const {
    programmaticRef,
    skipScrollEffectRef,
    lastEmittedRef,
    itemsRef,
    onSelectRef,
    onSettleRef,
    itemWidth,
  } = refs;
  return (offsetX: number) => {
    const list = itemsRef.current;
    if (list.length === 0) return;
    const next = clampIndex(indexFromOffset(offsetX, itemWidth), list.length);
    if (programmaticRef.current) {
      programmaticRef.current = false;
      return;
    }
    if (next !== lastEmittedRef.current) {
      lastEmittedRef.current = next;
      skipScrollEffectRef.current = true;
      onSelectRef.current(list[next] as T, next);
    }
    onSettleRef.current?.(list[next] as T, next);
  };
}

function makeSelectByIndex<T>(refs: EmitRefs<T>) {
  const {
    skipScrollEffectRef,
    lastEmittedRef,
    itemsRef,
    onSelectRef,
    onSettleRef,
  } = refs;
  return (index: number) => {
    const list = itemsRef.current;
    if (list.length === 0) return;
    const next = clampIndex(index, list.length);
    if (next === lastEmittedRef.current) return;
    lastEmittedRef.current = next;
    skipScrollEffectRef.current = false;
    onSelectRef.current(list[next] as T, next);
    onSettleRef.current?.(list[next] as T, next);
  };
}

function useEmitHandlers<T>(refs: EmitRefs<T>) {
  return {
    emitSelect: makeEmitSelect(refs),
    emitSettle: makeEmitSettle(refs),
    selectByIndex: makeSelectByIndex(refs),
  };
}

function useProgrammaticScrollSync(args: {
  listRef: ListRef;
  selectedIndex: number;
  itemWidth: number;
  itemsLength: number;
  skipScrollEffectRef: React.MutableRefObject<boolean>;
  programmaticRef: React.MutableRefObject<boolean>;
  lastEmittedRef: React.MutableRefObject<number>;
  itemsLenRef: React.MutableRefObject<number>;
}) {
  const {
    listRef,
    selectedIndex,
    itemWidth,
    itemsLength,
    skipScrollEffectRef,
    programmaticRef,
    lastEmittedRef,
    itemsLenRef,
  } = args;
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      itemsLenRef.current = itemsLength;
      lastEmittedRef.current = selectedIndex;
      return;
    }
    if (skipScrollEffectRef.current) {
      skipScrollEffectRef.current = false;
      lastEmittedRef.current = selectedIndex;
      return;
    }
    const list = listRef.current;
    if (list === null || itemsLength === 0) return;
    const index = clampIndex(selectedIndex, itemsLength);
    const target = offsetForIndex(index, itemWidth);
    const itemsChanged = itemsLenRef.current !== itemsLength;
    itemsLenRef.current = itemsLength;
    lastEmittedRef.current = index;
    programmaticRef.current = true;
    requestAnimationFrame(() => {
      list.scrollToOffset({ offset: target, animated: !itemsChanged });
      setTimeout(() => {
        programmaticRef.current = false;
      }, itemsChanged ? 0 : 320);
    });
  }, [
    listRef,
    selectedIndex,
    itemWidth,
    itemsLength,
    skipScrollEffectRef,
    programmaticRef,
    lastEmittedRef,
    itemsLenRef,
  ]);
}

type UseSelectionParams<T> = {
  listRef: ListRef;
  items: readonly T[];
  selectedIndex: number;
  itemWidth: number;
  onSelect: (item: T, index: number) => void;
  onSettle?: (item: T, index: number) => void;
};

export function useHorizontalPickerSelection<T>({
  listRef,
  items,
  selectedIndex,
  itemWidth,
  onSelect,
  onSettle,
}: UseSelectionParams<T>) {
  const programmaticRef = useRef(false);
  const skipScrollEffectRef = useRef(false);
  const lastEmittedRef = useRef(selectedIndex);
  const itemsLenRef = useRef(items.length);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  const { emitSelect, emitSettle, selectByIndex } = useEmitHandlers({
    programmaticRef,
    skipScrollEffectRef,
    lastEmittedRef,
    itemsRef,
    onSelectRef,
    onSettleRef,
    itemWidth,
  });

  useProgrammaticScrollSync({
    listRef,
    selectedIndex,
    itemWidth,
    itemsLength: items.length,
    skipScrollEffectRef,
    programmaticRef,
    lastEmittedRef,
    itemsLenRef,
  });

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      emitSettle(e.nativeEvent.contentOffset.x);
    },
    [emitSettle]
  );

  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vx = e.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(vx) > 0.05) return;
      emitSettle(e.nativeEvent.contentOffset.x);
    },
    [emitSettle]
  );

  return { emitSelect, selectByIndex, onScrollEnd, onScrollEndDrag };
}
