import { Platform } from 'react-native';
import { useEffect, useMemo, type ReactNode } from 'react';
import type { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { DragPieceNativeOverlay } from './chess-board-drag-piece-native-overlay';
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

type OverlayMotion = {
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupOpacity: SharedValue<number>;
  dragPickupScale: SharedValue<number>;
  pieceDraw: number;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
};

function buildWebDragNode(
  code: PieceCode,
  images: PieceImageCache,
  motion: OverlayMotion
): ReactNode {
  return (
    <DragPieceOverlay
      pieceImages={images}
      draggedPieceCode={code}
      dragX={motion.dragX}
      dragY={motion.dragY}
      isDragging={motion.isDragging}
      dragPickupOpacity={motion.dragPickupOpacity}
      dragPickupScale={motion.dragPickupScale}
      pieceDraw={motion.pieceDraw}
      originX={motion.originX}
      originY={motion.originY}
    />
  );
}

function buildNativeDragNode(
  code: PieceCode,
  motion: OverlayMotion
): ReactNode {
  return (
    <DragPieceNativeOverlay
      pieceCode={code}
      dragX={motion.dragX}
      dragY={motion.dragY}
      isDragging={motion.isDragging}
      dragPickupOpacity={motion.dragPickupOpacity}
      dragPickupScale={motion.dragPickupScale}
      pieceDraw={motion.pieceDraw}
      originX={motion.originX}
      originY={motion.originY}
    />
  );
}

function buildDragOverlayNode(p: {
  enabled: boolean;
  code: PieceCode | null;
  images: PieceImageCache | null;
  motion: OverlayMotion;
}): ReactNode | null {
  if (!p.enabled || p.code === null) return null;
  if (Platform.OS === 'web') {
    if (p.images === null) return null;
    return buildWebDragNode(p.code, p.images, p.motion);
  }
  return buildNativeDragNode(p.code, p.motion);
}

/**
 * Mounts the dragged piece into the app overlay portal so it sits above any
 * z-index. Origin is SharedValue-driven so measure updates do not remount.
 * Web uses Skia; native uses SvgXml (second Skia canvas crashes iOS; RN Image
 * data-URIs often fail to decode on iOS).
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
  const originX = dragOverlay.originX;
  const originY = dragOverlay.originY;

  useEffect(() => {
    setOverlayNode(
      buildDragOverlayNode({
        enabled,
        code: draggedPieceCode,
        images: pieceImages,
        motion: {
          dragX,
          dragY,
          isDragging,
          dragPickupOpacity,
          dragPickupScale,
          pieceDraw,
          originX,
          originY,
        },
      })
    );
  }, [
    enabled,
    setOverlayNode,
    originX,
    originY,
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
