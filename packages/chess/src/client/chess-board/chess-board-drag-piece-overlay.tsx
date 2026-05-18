import {
  Canvas,
  FilterMode,
  Image,
  MipmapMode,
} from '@shopify/react-native-skia';
import { forwardRef, memo } from 'react';
import type { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
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
 * Dragged piece rendered above the board (or in a portal). All motion happens
 * on the UI thread via `transform` (translate + scale) instead of `left`/`top`
 * so the browser compositor can promote the layer and avoid relayout on every
 * pointer frame.
 */
export const DragPieceOverlay = memo(
  forwardRef<View, DragPieceOverlayProps>(
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

      const offsetX = origin?.x ?? 0;
      const offsetY = origin?.y ?? 0;
      const half = pieceDraw / 2;

      const animatedStyle = useAnimatedStyle(() => ({
        transform: [
          { translateX: offsetX + dragX.value - half },
          { translateY: offsetY + dragY.value - half },
          { scale: dragPickupScale.value },
        ],
        opacity: isDragging.value ? dragPickupOpacity.value : 0,
      }));

      if (!pieceImages || draggedPieceCode === null) return null;

      const image = pieceImages[draggedPieceCode];

      // Fix top/left to 0 so transform alone drives motion (compositor-friendly).
      const baseStyle: StyleProp<ViewStyle> = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: pieceDraw,
        height: pieceDraw,
      };

      return (
        <Animated.View
          ref={ref}
          pointerEvents="none"
          style={[baseStyle, animatedStyle]}
        >
          <Canvas style={{ width: pieceDraw, height: pieceDraw }}>
            <Image
              image={image}
              x={0}
              y={0}
              width={pieceDraw}
              height={pieceDraw}
              sampling={{
                filter: FilterMode.Linear,
                mipmap: MipmapMode.Linear,
              }}
            />
          </Canvas>
        </Animated.View>
      );
    }
  )
) as React.MemoExoticComponent<
  React.ForwardRefExoticComponent<
    DragPieceOverlayProps & React.RefAttributes<View>
  >
>;
