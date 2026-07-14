import { useCallback, useMemo } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  HOVER_NONE,
  indexFromSquare,
} from './chess-board-geometry';
import type { ChessPieceRow } from './chess-board-piece-identities';
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
  pieceRows: readonly ChessPieceRow[];
  canDragFrom: (from: Square) => boolean;
  onDragStart: (from: Square) => void;
  onPanEnd: (from: Square, to: Square | null) => boolean;
  onSquareTap: (sq: Square) => void;
  clearHover: () => void;
};

function pieceColorAt(position: Position, sq: Square): 'w' | 'b' | null {
  const p = position[indexFromSquare(sq)] ?? null;
  return p?.color ?? null;
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
}): (from: Square, to: Square | null) => boolean {
  const { setDragFrom, setSelected, tryApplyDrop, clearHover } = args;
  return useStableHandler((from: Square, to: Square | null) => {
    clearHover();
    if (to === null || to === from) {
      setDragFrom(null);
      return false;
    }
    const applied = tryApplyDrop(from, to);
    setDragFrom(null);
    setSelected(null);
    return applied;
  });
}

/** Chess interaction: selection, O(1) drop apply, SharedValue hover. */
export function useChessBoardInteraction(
  args: UseChessBoardInteractionArgs
): UseChessBoardInteractionResult {
  const { hoverSquareIndex, clearHover } = useHoverRing();

  const canDragFrom = useCallback(
    (from: Square) => {
      if (!args.interactive) return false;
      return pieceColorAt(args.position, from) === args.turn;
    },
    [args.interactive, args.position, args.turn]
  );

  const onDragStart = useStableHandler((from: Square) => {
    args.setDragFrom(from);
    args.setSelected(from);
  });

  const onPanEnd = usePanEndHandler({
    setDragFrom: args.setDragFrom,
    setSelected: args.setSelected,
    tryApplyDrop: args.tryApplyDrop,
    clearHover,
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
      pieceRows: args.pieceRows,
      canDragFrom,
      onDragStart,
      onPanEnd,
      onSquareTap,
      clearHover,
    }),
    [
      hoverSquareIndex,
      args.pieceRows,
      canDragFrom,
      onDragStart,
      onPanEnd,
      onSquareTap,
      clearHover,
    ]
  );
}
