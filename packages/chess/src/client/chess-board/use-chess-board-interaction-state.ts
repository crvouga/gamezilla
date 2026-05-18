import { useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
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
  hoveredSquare: Square | null;
  setHoveredSquare: (sq: Square | null) => void;
  pendingPromotion: PendingPromotion | null;
  setPendingPromotion: (p: PendingPromotion | null) => void;
  /** Stable identity — safe to depend on in effects. */
  clearAll: () => void;
};

/** Bundles the four pieces of transient board interaction state and a stable
 * `clearAll` so callers don't have to re-derive it via `useCallback`. */
export function useChessBoardInteractionState(): ChessBoardInteractionState {
  const [selected, setSelected] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const clearAll = useStableHandler(() => {
    setSelected(null);
    setDragFrom(null);
    setHoveredSquare(null);
    setPendingPromotion(null);
  });

  return {
    selected,
    setSelected,
    dragFrom,
    setDragFrom,
    hoveredSquare,
    setHoveredSquare,
    pendingPromotion,
    setPendingPromotion,
    clearAll,
  };
}

export type ChessBoardDragSharedValues = {
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupScale: SharedValue<number>;
  dragPickupOpacity: SharedValue<number>;
};

/** All UI-thread drag motion values for the chess board (compositor-friendly). */
export function useChessBoardDragSharedValues(): ChessBoardDragSharedValues {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragPickupScale = useSharedValue(1);
  const dragPickupOpacity = useSharedValue(1);
  return { dragX, dragY, isDragging, dragPickupScale, dragPickupOpacity };
}
