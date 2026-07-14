import { useMemo, useState } from 'react';
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
