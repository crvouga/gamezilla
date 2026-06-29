import { Canvas } from '@shopify/react-native-skia';
import { forwardRef, memo } from 'react';
import { StyleSheet, View, type View as ViewType } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { ChessBoardDragPieceSkia } from './chess-board-piece';
import type { PieceCode } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';

export type DragPieceOverlayProps = {
  pieceImages: PieceImageCache | null;
  draggedPieceCode: PieceCode | null;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupOpacity: SharedValue<number>;
  dragPickupScale: SharedValue<number>;
  pieceDraw: number;
  /** When provided, the layer renders at `screen` coords (origin + drag). */
  origin?: { x: number; y: number };
};

/**
 * Dragged piece rendered above the board (or in a portal). Motion runs on the
 * UI thread via Skia `Group` transforms — never wrap Skia `Canvas` in Reanimated
 * `Animated.View` (crashes iOS when pickup opacity/scale animates).
 */
export const DragPieceOverlay = memo(
  forwardRef<ViewType, DragPieceOverlayProps>(
    function DragPieceOverlay(props, ref) {
      const {
        pieceImages,
        draggedPieceCode,
        dragX,
        dragY,
        isDragging,
        dragPickupOpacity,
        dragPickupScale,
        pieceDraw,
        origin,
      } = props;

      if (!pieceImages || draggedPieceCode === null) return null;

      const image = pieceImages[draggedPieceCode];
      const originX = origin?.x ?? 0;
      const originY = origin?.y ?? 0;

      return (
        <View ref={ref} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            <ChessBoardDragPieceSkia
              image={image}
              pieceSize={pieceDraw}
              dragX={dragX}
              dragY={dragY}
              isDragging={isDragging}
              pickupScale={dragPickupScale}
              pickupOpacity={dragPickupOpacity}
              originX={originX}
              originY={originY}
            />
          </Canvas>
        </View>
      );
    }
  )
) as React.MemoExoticComponent<
  React.ForwardRefExoticComponent<
    DragPieceOverlayProps & React.RefAttributes<ViewType>
  >
>;
