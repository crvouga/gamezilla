import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import type { PieceCode } from './chess-board-types';
import { PIECE_SVGS_CBURNETT } from './chess-pieces-svg';

export type DragPieceNativeOverlayProps = {
  pieceCode: PieceCode;
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
 * Native drag ghost: Reanimated `Animated.View` + `SvgXml`.
 *
 * Do not use RN `Image` + base64 data-URIs — iOS often fails to decode large
 * data URIs, so the ghost never appears while the board hides the source piece.
 * A second full-screen Skia `Canvas` in the portal also crashes iOS on pickup.
 */
export const DragPieceNativeOverlay = memo(function DragPieceNativeOverlay(
  props: DragPieceNativeOverlayProps
) {
  const {
    pieceCode,
    dragX,
    dragY,
    isDragging,
    dragPickupOpacity,
    dragPickupScale,
    pieceDraw,
    originX,
    originY,
  } = props;

  const xml = PIECE_SVGS_CBURNETT[pieceCode];

  const style = useAnimatedStyle(() => {
    const half = pieceDraw / 2;
    const visible = isDragging.value;
    const s = dragPickupScale.value;
    return {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: pieceDraw,
      height: pieceDraw,
      opacity: visible ? dragPickupOpacity.value : 0,
      transform: [
        { translateX: originX.value + dragX.value - half },
        { translateY: originY.value + dragY.value - half },
        { translateX: half },
        { translateY: half },
        { scale: s },
        { translateX: -half },
        { translateY: -half },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={style}>
        <SvgXml xml={xml} width={pieceDraw} height={pieceDraw} />
      </Animated.View>
    </View>
  );
});
