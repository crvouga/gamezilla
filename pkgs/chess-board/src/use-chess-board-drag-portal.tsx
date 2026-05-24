import { useEffect, useMemo } from 'react';
import type { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { DragPieceOverlay } from './chess-board-drag-piece-overlay';
import type { PieceCode } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';
import type { UseChessBoardDragOverlayResult } from './use-chess-board-drag-overlay';

export type DragPortalArgs = {
  dragOverlay: UseChessBoardDragOverlayResult;
  enabled: boolean;
  pieceImages: PieceImageCache | null;
  draggedPieceCode: PieceCode | null;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupOpacity: SharedValue<number>;
  dragPickupScale: SharedValue<number>;
  pieceDraw: number;
};

/**
 * Mounts the dragged piece into the app overlay portal so it sits above any
 * z-index. Pulls the `setOverlayNode` function out of `dragOverlay` and depends
 * on it directly so the effect doesn't re-run on every parent render.
 */
export function useChessBoardDragPortal(args: DragPortalArgs): void {
  const {
    dragOverlay,
    enabled,
    pieceImages,
    draggedPieceCode,
    dragX,
    dragY,
    isDragging,
    dragPickupOpacity,
    dragPickupScale,
    pieceDraw,
  } = args;
  const setOverlayNode = dragOverlay.setOverlayNode;
  const overlayOrigin = dragOverlay.origin;

  useEffect(() => {
    if (!enabled) {
      setOverlayNode(null);
      return;
    }
    if (draggedPieceCode === null || pieceImages === null) {
      setOverlayNode(null);
      return;
    }
    setOverlayNode(
      <DragPieceOverlay
        key="chess-drag-overlay"
        pieceImages={pieceImages}
        draggedPieceCode={draggedPieceCode}
        dragX={dragX}
        dragY={dragY}
        isDragging={isDragging}
        dragPickupOpacity={dragPickupOpacity}
        dragPickupScale={dragPickupScale}
        pieceDraw={pieceDraw}
        origin={overlayOrigin}
      />
    );
  }, [
    enabled,
    setOverlayNode,
    overlayOrigin,
    draggedPieceCode,
    pieceImages,
    dragX,
    dragY,
    isDragging,
    dragPickupOpacity,
    dragPickupScale,
    pieceDraw,
  ]);
}

/** Stable composed ref for the outer board View — must not depend on parent
 * objects (which change identity each render); depend on the stable callback
 * functions from each hook to avoid ref detach/reattach + measure thrash. */
export function useComposedContainerRef(
  refA: (n: View | null) => void,
  refB: (n: View | null) => void
): (n: View | null) => void {
  return useMemo(
    () => (n: View | null) => {
      refA(n);
      refB(n);
    },
    [refA, refB]
  );
}
