import { Box, ScrollView } from '@pkgs/ui';
import {
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  LayoutChangeEvent,
  ScrollView as RNScrollView,
  View,
} from 'react-native';

import type { PuzzleHistoryPly } from '../../shared/chess-puzzle-move-history';
import { HistoryPlyCluster } from './chess-puzzle-move-history-ply';

const ROW_HEIGHT = 28;

export type ChessPuzzleMoveHistoryProps = {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
};

type PlyOffset = { x: number; width: number };

type ScrollIntoViewOptions = {
  behavior?: 'smooth' | 'auto';
  inline?: 'center' | 'nearest' | 'start' | 'end';
  block?: 'nearest';
};

type ViewWithScrollIntoView = View & {
  scrollIntoView?: (options?: ScrollIntoViewOptions) => void;
};

function centerOffsetTarget(offset: PlyOffset, viewportWidth: number): number {
  return Math.max(0, offset.x + offset.width / 2 - viewportWidth / 2);
}

function scrollSelectedIntoView(args: {
  selected: ViewWithScrollIntoView | null;
  scroll: RNScrollView | null;
  offset: PlyOffset | undefined;
  viewportWidth: number;
}): void {
  const { selected, scroll, offset, viewportWidth } = args;
  if (selected !== null && typeof selected.scrollIntoView === 'function') {
    selected.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
    return;
  }
  if (scroll === null || offset === undefined || viewportWidth <= 0) return;
  scroll.scrollTo({
    x: centerOffsetTarget(offset, viewportWidth),
    animated: true,
  });
}

function useAutoScrollToSelected(args: {
  selectedSolveIdx: number;
  plyCount: number;
  offsets: ReadonlyMap<number, PlyOffset>;
  scrollRef: RefObject<RNScrollView | null>;
  selectedRef: RefObject<View | null>;
  viewportWidth: number;
}): void {
  const {
    selectedSolveIdx,
    plyCount,
    offsets,
    scrollRef,
    selectedRef,
    viewportWidth,
  } = args;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollSelectedIntoView({
        selected: selectedRef.current,
        scroll: scrollRef.current,
        offset: offsets.get(selectedSolveIdx),
        viewportWidth,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    offsets,
    plyCount,
    scrollRef,
    selectedRef,
    selectedSolveIdx,
    viewportWidth,
  ]);
}

function usePlyOffsets(): {
  offsets: ReadonlyMap<number, PlyOffset>;
  onPlyLayout: (solveIdxAfter: number, event: LayoutChangeEvent) => void;
  resetOffsets: () => void;
} {
  const offsetsRef = useRef(new Map<number, PlyOffset>());
  const [offsets, setOffsets] = useState<ReadonlyMap<number, PlyOffset>>(
    () => new Map()
  );
  const resetOffsets = useCallback(() => {
    offsetsRef.current = new Map();
    setOffsets(new Map());
  }, []);
  const onPlyLayout = useCallback(
    (solveIdxAfter: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      const prev = offsetsRef.current.get(solveIdxAfter);
      if (prev !== undefined && prev.x === x && prev.width === width) return;
      const next = new Map(offsetsRef.current);
      next.set(solveIdxAfter, { x, width });
      offsetsRef.current = next;
      setOffsets(next);
    },
    []
  );
  return { offsets, onPlyLayout, resetOffsets };
}

function useResetOffsetsOnShrink(
  plyCount: number,
  resetOffsets: () => void
): void {
  const prevPlyCountRef = useRef(plyCount);
  useEffect(() => {
    if (plyCount < prevPlyCountRef.current) {
      resetOffsets();
    }
    prevPlyCountRef.current = plyCount;
  }, [plyCount, resetOffsets]);
}

function MoveHistoryScroll(p: {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
  onPlyLayout: (solveIdxAfter: number, event: LayoutChangeEvent) => void;
  scrollRef: RefObject<RNScrollView | null>;
  selectedRef: RefObject<View | null>;
  onViewportLayout: (event: LayoutChangeEvent) => void;
}): ReactNode {
  return (
    <Box
      testID="chess-puzzle-move-history"
      sx={{
        alignSelf: 'stretch',
        height: ROW_HEIGHT,
        background: 'surfaceMuted',
        borderRadius: 8,
        justifyContent: 'center',
      }}
      onLayout={p.onViewportLayout}
    >
      <ScrollView
        ref={p.scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          px: 3,
          gap: 2,
          minHeight: ROW_HEIGHT,
        }}
      >
        {p.plies.map((ply) => {
          const selected = ply.solveIdxAfter === p.selectedSolveIdx;
          return (
            <HistoryPlyCluster
              key={ply.plyIndex}
              ply={ply}
              selectedSolveIdx={p.selectedSolveIdx}
              interactive={p.interactive}
              onSeek={p.onSeek}
              onPlyLayout={p.onPlyLayout}
              {...(selected ? { selectedRef: p.selectedRef as Ref<View> } : {})}
            />
          );
        })}
      </ScrollView>
    </Box>
  );
}

/**
 * Chess.com-style horizontal SAN move strip: move numbers + tappable plies,
 * current position highlighted in green, auto-scrolls to selection.
 */
export function ChessPuzzleMoveHistory(
  p: ChessPuzzleMoveHistoryProps
): ReactNode {
  const scrollRef = useRef<RNScrollView>(null);
  const selectedRef = useRef<View>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const { offsets, onPlyLayout, resetOffsets } = usePlyOffsets();
  useResetOffsetsOnShrink(p.plies.length, resetOffsets);
  useAutoScrollToSelected({
    selectedSolveIdx: p.selectedSolveIdx,
    plyCount: p.plies.length,
    offsets,
    scrollRef,
    selectedRef,
    viewportWidth,
  });

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
  }, []);

  if (p.plies.length === 0) {
    return (
      <Box
        testID="chess-puzzle-move-history"
        sx={{
          alignSelf: 'stretch',
          height: ROW_HEIGHT,
          background: 'surfaceMuted',
          borderRadius: 8,
        }}
      />
    );
  }

  return (
    <MoveHistoryScroll
      plies={p.plies}
      selectedSolveIdx={p.selectedSolveIdx}
      interactive={p.interactive}
      onSeek={p.onSeek}
      onPlyLayout={onPlyLayout}
      scrollRef={scrollRef}
      selectedRef={selectedRef}
      onViewportLayout={onViewportLayout}
    />
  );
}
