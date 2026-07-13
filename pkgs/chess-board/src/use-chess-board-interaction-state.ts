import { useMemo, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { HOVER_NONE } from './chess-board-geometry';
import type { PieceColor, Square } from './chess-board-types';
import { useStableHandler } from './use-stable-handler';

export type PendingPromotion = {
  from: Square;
  to: Square;
  color: PieceColor;
};

export type ChessBoardInteractionState = {
  selected: Square | null;
  setSelected: (sq: Square | null) => void;
  dragFrom: Square | null;
  setDragFrom: (sq: Square | null) => void;
  pendingPromotion: PendingPromotion | null;
  setPendingPromotion: (p: PendingPromotion | null) => void;
  /** Stable identity — safe to depend on in effects. */
  clearAll: () => void;
};

/** Bundles transient board interaction state and a stable `clearAll`. */
export function useChessBoardInteractionState(): ChessBoardInteractionState {
  const [selected, setSelected] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const clearAll = useStableHandler(() => {
    setSelected(null);
    setDragFrom(null);
    setPendingPromotion(null);
  });

  // Stable object identity across renders when values are unchanged — keeps
  // downstream contentProps memo from thrashing on every parent render.
  return useMemo(
    () => ({
      selected,
      setSelected,
      dragFrom,
      setDragFrom,
      pendingPromotion,
      setPendingPromotion,
      clearAll,
    }),
    [selected, dragFrom, pendingPromotion, clearAll]
  );
}

export type ChessBoardDragSharedValues = {
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupScale: SharedValue<number>;
  dragPickupOpacity: SharedValue<number>;
  /** UI-thread hover square index (-1 = none). */
  hoverSquareIndex: SharedValue<number>;
};

/** All UI-thread drag motion values for the chess board (compositor-friendly). */
export function useChessBoardDragSharedValues(): ChessBoardDragSharedValues {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragPickupScale = useSharedValue(1);
  const dragPickupOpacity = useSharedValue(1);
  const hoverSquareIndex = useSharedValue(HOVER_NONE);
  return {
    dragX,
    dragY,
    isDragging,
    dragPickupScale,
    dragPickupOpacity,
    hoverSquareIndex,
  };
}
