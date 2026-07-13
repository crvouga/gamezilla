import { Canvas } from '@shopify/react-native-skia';
import { forwardRef, memo } from 'react';
import { StyleSheet, View, type View as ViewType } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { ChessBoardDragPieceSkia } from './chess-board-piece';
import type { PieceCode } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';

export type DragPieceOverlayProps = {
  pieceImages: PieceImageCache;
  draggedPieceCode: PieceCode;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  dragPickupOpacity: SharedValue<number>;
  dragPickupScale: SharedValue<number>;
  pieceDraw: number;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
};

/**
 * Web drag piece in the overlay portal. Motion runs on the UI thread via
 * Skia `Group` transforms — never wrap Skia `Canvas` in Reanimated
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
        originX,
        originY,
      } = props;

      const image = pieceImages[draggedPieceCode];

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
