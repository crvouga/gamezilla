import { Box, ScrollView } from '@pkgs/ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LayoutChangeEvent, ScrollView as RNScrollView } from 'react-native';

import type { PuzzleHistoryPly } from '../../shared/chess-puzzle-move-history';
import { HistoryPlyCluster } from './chess-puzzle-move-history-ply';

const ROW_HEIGHT = 40;

export type ChessPuzzleMoveHistoryProps = {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
};

type PlyOffset = { x: number; width: number };

function useAutoScrollToSelected(args: {
  selectedSolveIdx: number;
  offsets: ReadonlyMap<number, PlyOffset>;
  scrollRef: React.RefObject<RNScrollView | null>;
  viewportWidth: number;
}): void {
  const { selectedSolveIdx, offsets, scrollRef, viewportWidth } = args;
  useEffect(() => {
    const scroll = scrollRef.current;
    const offset = offsets.get(selectedSolveIdx);
    if (scroll === null || offset === undefined || viewportWidth <= 0) return;
    const target = Math.max(0, offset.x + offset.width / 2 - viewportWidth / 2);
    scroll.scrollTo({ x: target, animated: true });
  }, [offsets, scrollRef, selectedSolveIdx, viewportWidth]);
}

function usePlyOffsets(): {
  offsets: ReadonlyMap<number, PlyOffset>;
  onPlyLayout: (solveIdxAfter: number, event: LayoutChangeEvent) => void;
} {
  const offsetsRef = useRef(new Map<number, PlyOffset>());
  const [offsets, setOffsets] = useState<ReadonlyMap<number, PlyOffset>>(
    () => new Map()
  );
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
  return { offsets, onPlyLayout };
}

/**
 * Chess.com-style horizontal SAN move strip: move numbers + tappable plies,
 * current position highlighted in green, auto-scrolls to selection.
 */
export function ChessPuzzleMoveHistory(
  p: ChessPuzzleMoveHistoryProps
): ReactNode {
  const scrollRef = useRef<RNScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const { offsets, onPlyLayout } = usePlyOffsets();
  useAutoScrollToSelected({
    selectedSolveIdx: p.selectedSolveIdx,
    offsets,
    scrollRef,
    viewportWidth,
  });

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
    <Box
      testID="chess-puzzle-move-history"
      sx={{
        alignSelf: 'stretch',
        height: ROW_HEIGHT,
        background: 'surfaceMuted',
        borderRadius: 8,
        justifyContent: 'center',
      }}
      onLayout={(event) => {
        setViewportWidth(event.nativeEvent.layout.width);
      }}
    >
      <ScrollView
        ref={scrollRef}
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
        {p.plies.map((ply) => (
          <HistoryPlyCluster
            key={ply.plyIndex}
            ply={ply}
            selectedSolveIdx={p.selectedSolveIdx}
            interactive={p.interactive}
            onSeek={p.onSeek}
            onPlyLayout={onPlyLayout}
          />
        ))}
      </ScrollView>
    </Box>
  );
}
