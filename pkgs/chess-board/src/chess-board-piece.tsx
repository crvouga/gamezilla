import {
  Group,
  Image,
  FilterMode,
  MipmapMode,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, type ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const PIECE_DRAW_SCALE = 1.06;
/** Piece slide duration; keep capture ghost + capture SFX aligned with this. */
export const CHESS_PIECE_MOVE_MS = 200;
const MOVE_MS = CHESS_PIECE_MOVE_MS;
const FADE_IN_MS = 160;
const FADE_OUT_MS = 140;

export type ChessBoardPieceSkiaProps = {
  image: SkImage;
  pieceSize: number;
  /** Board pixel center X of the piece cell */
  targetCenterX: number;
  targetCenterY: number;
  /** Fade in when the piece first appears (mount) */
  fadeInOnMount?: boolean;
  /** If set, animate opacity to 0 then call onFadeOutComplete */
  fadeOut?: boolean;
  onFadeOutComplete?: () => void;
  /** Extra scale around cell center (1 = default) */
  restScale?: number;
};

/* eslint-disable max-lines-per-function */
export function ChessBoardPieceSkia(
  props: ChessBoardPieceSkiaProps
): ReactNode {
  const {
    image,
    pieceSize,
    targetCenterX,
    targetCenterY,
    fadeInOnMount = false,
    fadeOut = false,
    onFadeOutComplete,
    restScale = 1,
  } = props;

  const topLeftX = useSharedValue(targetCenterX - pieceSize / 2);
  const topLeftY = useSharedValue(targetCenterY - pieceSize / 2);
  const opacity = useSharedValue(fadeInOnMount ? 0 : 1);
  const scaleSV = useSharedValue(restScale);

  useEffect(() => {
    topLeftX.value = withTiming(targetCenterX - pieceSize / 2, {
      duration: MOVE_MS,
      easing: Easing.out(Easing.cubic),
    });
    topLeftY.value = withTiming(targetCenterY - pieceSize / 2, {
      duration: MOVE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [pieceSize, targetCenterX, targetCenterY, topLeftX, topLeftY]);

  useEffect(() => {
    scaleSV.value = withTiming(restScale, {
      duration: 120,
      easing: Easing.out(Easing.cubic),
    });
  }, [restScale, scaleSV]);

  useEffect(() => {
    if (fadeInOnMount) {
      opacity.value = 0;
      opacity.value = withTiming(1, {
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [fadeInOnMount, opacity]);

  useEffect(() => {
    if (!fadeOut) return;
    scaleSV.value = withTiming(0.5, {
      duration: FADE_OUT_MS,
      easing: Easing.in(Easing.cubic),
    });
    opacity.value = withTiming(
      0,
      { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished && onFadeOutComplete) {
          runOnJS(onFadeOutComplete)();
        }
      }
    );
  }, [fadeOut, onFadeOutComplete, opacity, scaleSV]);

  const transform = useDerivedValue(() => {
    const cx = pieceSize / 2;
    const cy = pieceSize / 2;
    const s = scaleSV.value;
    return [
      { translateX: topLeftX.value + cx },
      { translateY: topLeftY.value + cy },
      { scale: s },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  return (
    <Group transform={transform} opacity={opacity}>
      <Image
        image={image}
        x={0}
        y={0}
        width={pieceSize}
        height={pieceSize}
        sampling={{
          filter: FilterMode.Linear,
          mipmap: MipmapMode.Linear,
        }}
      />
    </Group>
  );
}

export type ChessBoardDragPieceSkiaProps = {
  image: SkImage;
  pieceSize: number;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  pickupScale: SharedValue<number>;
  pickupOpacity: SharedValue<number>;
};

export function ChessBoardDragPieceSkia(
  props: ChessBoardDragPieceSkiaProps
): ReactNode {
  const {
    image,
    pieceSize,
    dragX,
    dragY,
    isDragging,
    pickupScale,
    pickupOpacity,
  } = props;

  const transform = useDerivedValue(() => {
    const cx = pieceSize / 2;
    const cy = pieceSize / 2;
    const topLeftX = dragX.value - pieceSize / 2;
    const topLeftY = dragY.value - pieceSize / 2;
    const s = pickupScale.value;
    return [
      { translateX: topLeftX + cx },
      { translateY: topLeftY + cy },
      { scale: s },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  const opacity = useDerivedValue(() =>
    isDragging.value ? pickupOpacity.value : 0
  );

  return (
    <Group transform={transform} opacity={opacity}>
      <Image
        image={image}
        x={0}
        y={0}
        width={pieceSize}
        height={pieceSize}
        sampling={{
          filter: FilterMode.Linear,
          mipmap: MipmapMode.Linear,
        }}
      />
    </Group>
  );
}
