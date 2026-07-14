import { useCallback, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import {
  HOVER_NONE,
  indexFromSquare,
  squareFromIndex,
} from './chess-board-geometry';
import type { ChessPieceDragData } from './chess-board-dnd-types';
import type { ChessPieceRow } from './chess-board-piece-identities';
import type { Position, Square } from './chess-board-types';
import { useStableHandler } from './use-stable-handler';

export type UseChessBoardDndArgs = {
  interactive: boolean;
  turn: 'w' | 'b';
  position: Position;
  pieceRows: readonly ChessPieceRow[];
  selected: Square | null;
  setSelected: (sq: Square | null) => void;
  setDragFrom: (sq: Square | null) => void;
  tryApplyDrop: (from: Square, to: Square) => boolean;
};

export type UseChessBoardDndResult = {
  hoverSquareIndex: SharedValue<number>;
  dragData: readonly ChessPieceDragData[];
  remountKeys: Readonly<Record<string, number>>;
  canDragFrom: (from: Square) => boolean;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onDropToSquare: (from: Square, to: Square) => void;
  onSquareTap: (sq: Square) => void;
  onHoverChange: (sq: Square, active: boolean) => void;
};

/** All 64 board squares in a1…h8 order. */
export const ALL_BOARD_SQUARES: readonly Square[] = Array.from(
  { length: 64 },
  (_, i) => squareFromIndex(i)
);

function pieceColorAt(position: Position, sq: Square): 'w' | 'b' | null {
  const p = position[indexFromSquare(sq)] ?? null;
  return p?.color ?? null;
}

function writeHover(
  sv: SharedValue<number>,
  next: number
): void {
  sv.value = next;
}

function useRemountKeys(): {
  remountKeys: Record<string, number>;
  bump: (id: string) => void;
} {
  const [remountKeys, setRemountKeys] = useState<Record<string, number>>({});
  const bump = useStableHandler((id: string) => {
    setRemountKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  });
  return { remountKeys, bump };
}

function useHoverRing(): {
  hoverSquareIndex: SharedValue<number>;
  clearHover: () => void;
  onHoverChange: (sq: Square, active: boolean) => void;
} {
  const hoverSquareIndex = useSharedValue(HOVER_NONE);
  const hoverRef = useRef(hoverSquareIndex);
  const activeHoverRef = useRef<Square | null>(null);
  const clearHover = useCallback(() => {
    writeHover(hoverRef.current, HOVER_NONE);
    activeHoverRef.current = null;
  }, []);
  const onHoverChange = useCallback((sq: Square, active: boolean) => {
    if (active) {
      activeHoverRef.current = sq;
      writeHover(hoverRef.current, indexFromSquare(sq));
      return;
    }
    if (activeHoverRef.current === sq) {
      activeHoverRef.current = null;
      writeHover(hoverRef.current, HOVER_NONE);
    }
  }, []);
  return { hoverSquareIndex, clearHover, onHoverChange };
}

function useIdBySquare(
  pieceRows: readonly ChessPieceRow[]
): Map<Square, string> {
  return useMemo(() => {
    const m = new Map<Square, string>();
    for (const row of pieceRows) m.set(row.square, row.id);
    return m;
  }, [pieceRows]);
}

function useDragData(
  pieceRows: readonly ChessPieceRow[]
): readonly ChessPieceDragData[] {
  return useMemo(
    () =>
      pieceRows.map((row) => ({
        id: row.id,
        from: row.square,
        code: row.code,
      })),
    [pieceRows]
  );
}

function useDropCallbacks(args: {
  setDragFrom: (sq: Square | null) => void;
  setSelected: (sq: Square | null) => void;
  tryApplyDrop: (from: Square, to: Square) => boolean;
  idBySquare: Map<Square, string>;
  bump: (id: string) => void;
  clearHover: () => void;
}): Pick<UseChessBoardDndResult, 'onDropToSquare' | 'onDragEnd'> {
  const {
    setDragFrom,
    setSelected,
    tryApplyDrop,
    idBySquare,
    bump,
    clearHover,
  } = args;
  const onDragEnd = useStableHandler(() => {
    setDragFrom(null);
    clearHover();
  });
  const onDropToSquare = useStableHandler((from: Square, to: Square) => {
    const id = idBySquare.get(from);
    if (from === to) {
      // Same-cell release: no remount — keep selection from onDragStart.
      setDragFrom(null);
      clearHover();
      return;
    }
    tryApplyDrop(from, to);
    // Remount only after a real move so library tx/ty are cleared once.
    if (id) bump(id);
    setDragFrom(null);
    setSelected(null);
    clearHover();
  });
  return { onDragEnd, onDropToSquare };
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

/** Bridges library DnD callbacks to chess selection, drop apply, hover. */
export function useChessBoardDnd(
  args: UseChessBoardDndArgs
): UseChessBoardDndResult {
  const { remountKeys, bump } = useRemountKeys();
  const { hoverSquareIndex, clearHover, onHoverChange } = useHoverRing();
  const idBySquare = useIdBySquare(args.pieceRows);
  const dragData = useDragData(args.pieceRows);
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
  const { onDragEnd, onDropToSquare } = useDropCallbacks({
    setDragFrom: args.setDragFrom,
    setSelected: args.setSelected,
    tryApplyDrop: args.tryApplyDrop,
    idBySquare,
    bump,
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
  return {
    hoverSquareIndex,
    dragData,
    remountKeys,
    canDragFrom,
    onDragStart,
    onDragEnd,
    onDropToSquare,
    onSquareTap,
    onHoverChange,
  };
}
