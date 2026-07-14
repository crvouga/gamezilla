import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  HOVER_NONE,
  indexFromSquare,
} from './chess-board-geometry';
import {
  clearDragMotion,
  DRAG_PIECE_NONE,
  emptyDragKeyTable,
  hashPieceId,
  useChessBoardDragMotion,
  type ChessBoardDragMotion,
} from './chess-board-drag-motion';
import type { ChessPieceRow } from './chess-board-piece-identities';
import { markChessPerf } from './chess-board-perf';
import type { Position, Square } from './chess-board-types';
import { useStableHandler } from './use-stable-handler';

export type UseChessBoardInteractionArgs = {
  interactive: boolean;
  turn: 'w' | 'b';
  position: Position;
  pieceRows: readonly ChessPieceRow[];
  selected: Square | null;
  setSelected: (sq: Square | null) => void;
  setDragFrom: (sq: Square | null) => void;
  tryApplyDrop: (from: Square, to: Square) => boolean;
};

export type UseChessBoardInteractionResult = {
  hoverSquareIndex: SharedValue<number>;
  drag: ChessBoardDragMotion;
  /** Square-index → pieceKey for UI-thread pan hit-test (-1 = empty/blocked). */
  dragKeyTable: SharedValue<number[]>;
  pieceRows: readonly ChessPieceRow[];
  snapKeys: ReadonlySet<number>;
  onDragStart: (from: Square, pieceKey: number) => void;
  onPanEnd: (from: Square, to: Square | null, pieceKey: number) => boolean;
  onSquareTap: (sq: Square) => void;
  onSnapConsumed: (pieceKey: number) => void;
  onDragCancel: () => void;
};

function pieceColorAt(position: Position, sq: Square): 'w' | 'b' | null {
  const p = position[indexFromSquare(sq)] ?? null;
  return p?.color ?? null;
}

function buildDragKeyTable(
  rows: readonly ChessPieceRow[],
  interactive: boolean,
  turn: 'w' | 'b',
  position: Position
): number[] {
  const table = emptyDragKeyTable();
  if (!interactive) return table;
  for (const row of rows) {
    if (pieceColorAt(position, row.square) !== turn) continue;
    table[indexFromSquare(row.square)] = hashPieceId(row.id);
  }
  return table;
}

function useHoverRing(): {
  hoverSquareIndex: SharedValue<number>;
  clearHover: () => void;
} {
  const hoverSquareIndex = useSharedValue(HOVER_NONE);
  const clearHover = useCallback(() => {
    hoverSquareIndex.value = HOVER_NONE;
  }, [hoverSquareIndex]);
  return { hoverSquareIndex, clearHover };
}

function useSnapKeys(): {
  snapKeys: ReadonlySet<number>;
  markSnap: (pieceKey: number) => void;
  onSnapConsumed: (pieceKey: number) => void;
} {
  const [snapKeys, setSnapKeys] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  const markSnap = useStableHandler((pieceKey: number) => {
    setSnapKeys((prev) => {
      if (prev.has(pieceKey)) return prev;
      const next = new Set(prev);
      next.add(pieceKey);
      return next;
    });
  });
  const onSnapConsumed = useStableHandler((pieceKey: number) => {
    setSnapKeys((prev) => {
      if (!prev.has(pieceKey)) return prev;
      const next = new Set(prev);
      next.delete(pieceKey);
      return next;
    });
  });
  return { snapKeys, markSnap, onSnapConsumed };
}

function useTapHandler(args: {
  interactive: boolean;
  turn: 'w' | 'b';
  position: Position;
  selected: Square | null;
  setSelected: (sq: Square | null) => void;
  tryApplyDrop: (from: Square, to: Square) => boolean;
}): (sq: Square) => void {
  const {
    interactive,
    turn,
    position,
    selected,
    setSelected,
    tryApplyDrop,
  } = args;
  return useStableHandler((sq: Square) => {
    if (!interactive) return;
    if (selected === null) {
      if (pieceColorAt(position, sq) === turn) setSelected(sq);
      return;
    }
    if (sq === selected) {
      setSelected(null);
      return;
    }
    tryApplyDrop(selected, sq);
    setSelected(null);
  });
}

function usePanEndHandler(args: {
  setDragFrom: (sq: Square | null) => void;
  setSelected: (sq: Square | null) => void;
  tryApplyDrop: (from: Square, to: Square) => boolean;
  clearHover: () => void;
  markSnap: (pieceKey: number) => void;
  clearDragVisual: () => void;
}): (from: Square, to: Square | null, pieceKey: number) => boolean {
  const {
    setDragFrom,
    setSelected,
    tryApplyDrop,
    clearHover,
    markSnap,
    clearDragVisual,
  } = args;
  return useStableHandler(
    (from: Square, to: Square | null, pieceKey: number) => {
      clearHover();
      markChessPerf('chess-drop');
      if (to === null || to === from) {
        setDragFrom(null);
        clearDragVisual();
        return false;
      }
      const applied = tryApplyDrop(from, to);
      setDragFrom(null);
      setSelected(null);
      if (applied) {
        markSnap(pieceKey);
        return true;
      }
      clearDragVisual();
      return false;
    }
  );
}

function useDragKeyTable(
  args: UseChessBoardInteractionArgs
): SharedValue<number[]> {
  const dragKeyTable = useSharedValue(emptyDragKeyTable());
  useEffect(() => {
    dragKeyTable.value = buildDragKeyTable(
      args.pieceRows,
      args.interactive,
      args.turn,
      args.position
    );
  }, [
    args.interactive,
    args.pieceRows,
    args.position,
    args.turn,
    dragKeyTable,
  ]);
  return dragKeyTable;
}

/** Chess interaction: selection, SharedValue hover + board drag motion. */
export function useChessBoardInteraction(
  args: UseChessBoardInteractionArgs
): UseChessBoardInteractionResult {
  const { hoverSquareIndex, clearHover } = useHoverRing();
  const drag = useChessBoardDragMotion();
  const dragKeyTable = useDragKeyTable(args);
  const { snapKeys, markSnap, onSnapConsumed } = useSnapKeys();
  const clearDragVisual = useCallback(() => {
    clearDragMotion(drag);
  }, [drag]);

  const onDragStart = useStableHandler((from: Square, _pieceKey: number) => {
    markChessPerf('chess-drag-start');
    args.setDragFrom(from);
    args.setSelected(from);
  });
  const onDragCancel = useStableHandler(() => {
    clearDragVisual();
    args.setDragFrom(null);
  });
  const onPanEnd = usePanEndHandler({
    setDragFrom: args.setDragFrom,
    setSelected: args.setSelected,
    tryApplyDrop: args.tryApplyDrop,
    clearHover,
    markSnap,
    clearDragVisual,
  });
  const onSquareTap = useTapHandler({
    interactive: args.interactive,
    turn: args.turn,
    position: args.position,
    selected: args.selected,
    setSelected: args.setSelected,
    tryApplyDrop: args.tryApplyDrop,
  });

  return useMemo(
    () => ({
      hoverSquareIndex,
      drag,
      dragKeyTable,
      pieceRows: args.pieceRows,
      snapKeys,
      onDragStart,
      onPanEnd,
      onSquareTap,
      onSnapConsumed,
      onDragCancel,
    }),
    [
      hoverSquareIndex,
      drag,
      dragKeyTable,
      args.pieceRows,
      snapKeys,
      onDragStart,
      onPanEnd,
      onSquareTap,
      onSnapConsumed,
      onDragCancel,
    ]
  );
}

export { DRAG_PIECE_NONE };
