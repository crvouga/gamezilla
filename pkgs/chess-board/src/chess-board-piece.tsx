import {
  Group,
  Image,
  FilterMode,
  MipmapMode,
  type SkImage,
} from '@shopify/react-native-skia';
import { memo, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  clearDragMotion,
  type ChessBoardDragMotion,
} from './chess-board-drag-motion';

export const PIECE_DRAW_SCALE = 1.06;
/** Piece slide duration; keep capture ghost + capture SFX aligned with this. */
export const CHESS_PIECE_MOVE_MS = 200;
const MOVE_MS = CHESS_PIECE_MOVE_MS;
const FADE_IN_MS = 160;
const FADE_OUT_MS = 140;
const MOVE_EASING = Easing.out(Easing.cubic);

export type ChessBoardPieceSkiaProps = {
  image: SkImage;
  pieceSize: number;
  targetCenterX: number;
  targetCenterY: number;
  fadeInOnMount?: boolean;
  fadeOut?: boolean;
  onFadeOutComplete?: () => void;
  restScale?: number;
  /** Stable hash of piece row id — matches board drag.pieceKey while dragging. */
  pieceKey?: number;
  drag?: ChessBoardDragMotion;
  /** When true on next layout, seed position + clear board drag atomically. */
  snapLayout?: boolean;
  onSnapConsumed?: () => void;
};

type LayoutArgs = {
  pieceSize: number;
  targetCenterX: number;
  targetCenterY: number;
  topLeftX: SharedValue<number>;
  topLeftY: SharedValue<number>;
  snapLayout: boolean;
  drag: ChessBoardDragMotion | undefined;
  pieceKey: number | undefined;
  onSnapConsumed: (() => void) | undefined;
};

function usePieceLayoutMotion(args: LayoutArgs): void {
  const {
    pieceSize,
    targetCenterX,
    targetCenterY,
    topLeftX,
    topLeftY,
    snapLayout,
    drag,
    pieceKey,
    onSnapConsumed,
  } = args;
  const firstRef = useRef(true);

  useLayoutEffect(() => {
    const nextX = targetCenterX - pieceSize / 2;
    const nextY = targetCenterY - pieceSize / 2;
    const isFirst = firstRef.current;
    firstRef.current = false;
    if (isFirst || snapLayout) {
      topLeftX.value = nextX;
      topLeftY.value = nextY;
      if (
        snapLayout &&
        drag &&
        pieceKey !== undefined &&
        drag.pieceKey.value === pieceKey
      ) {
        clearDragMotion(drag);
      }
      if (snapLayout) onSnapConsumed?.();
      return;
    }
    topLeftX.value = withTiming(nextX, {
      duration: MOVE_MS,
      easing: MOVE_EASING,
    });
    topLeftY.value = withTiming(nextY, {
      duration: MOVE_MS,
      easing: MOVE_EASING,
    });
  }, [
    drag,
    onSnapConsumed,
    pieceKey,
    pieceSize,
    snapLayout,
    targetCenterX,
    targetCenterY,
    topLeftX,
    topLeftY,
  ]);
}

type FadeArgs = {
  fadeInOnMount: boolean;
  fadeOut: boolean;
  restScale: number;
  opacity: SharedValue<number>;
  scaleSV: SharedValue<number>;
  onFadeOutComplete: (() => void) | undefined;
};

function usePieceFadeMotion(args: FadeArgs): void {
  const {
    fadeInOnMount,
    fadeOut,
    restScale,
    opacity,
    scaleSV,
    onFadeOutComplete,
  } = args;

  useLayoutEffect(() => {
    scaleSV.value = withTiming(restScale, {
      duration: 120,
      easing: MOVE_EASING,
    });
  }, [restScale, scaleSV]);

  useLayoutEffect(() => {
    if (!fadeInOnMount) return;
    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: FADE_IN_MS,
      easing: MOVE_EASING,
    });
  }, [fadeInOnMount, opacity]);

  useLayoutEffect(() => {
    if (!fadeOut) return;
    scaleSV.value = withTiming(0.5, {
      duration: FADE_OUT_MS,
      easing: Easing.in(Easing.cubic),
    });
    opacity.value = withTiming(
      0,
      { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished && onFadeOutComplete) runOnJS(onFadeOutComplete)();
      }
    );
  }, [fadeOut, onFadeOutComplete, opacity, scaleSV]);
}

function usePieceTransform(args: {
  pieceSize: number;
  pieceKey: number | undefined;
  drag: ChessBoardDragMotion | undefined;
  topLeftX: SharedValue<number>;
  topLeftY: SharedValue<number>;
  scaleSV: SharedValue<number>;
}) {
  const { pieceSize, pieceKey, drag, topLeftX, topLeftY, scaleSV } = args;
  return useDerivedValue(() => {
    const cx = pieceSize / 2;
    const cy = pieceSize / 2;
    const dragging =
      drag !== undefined &&
      pieceKey !== undefined &&
      drag.pieceKey.value === pieceKey;
    const tx = dragging ? drag.tx.value : 0;
    const ty = dragging ? drag.ty.value : 0;
    const lift = dragging ? drag.scale.value : 1;
    const s = scaleSV.value * lift;
    return [
      { translateX: topLeftX.value + cx + tx },
      { translateY: topLeftY.value + cy + ty },
      { scale: s },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });
}

function ChessBoardPieceSkiaImpl(props: ChessBoardPieceSkiaProps): ReactNode {
  const {
    image,
    pieceSize,
    targetCenterX,
    targetCenterY,
    fadeInOnMount = false,
    fadeOut = false,
    onFadeOutComplete,
    restScale = 1,
    pieceKey,
    drag,
    snapLayout = false,
    onSnapConsumed,
  } = props;

  const topLeftX = useSharedValue(targetCenterX - pieceSize / 2);
  const topLeftY = useSharedValue(targetCenterY - pieceSize / 2);
  const opacity = useSharedValue(fadeInOnMount ? 0 : 1);
  const scaleSV = useSharedValue(restScale);

  usePieceLayoutMotion({
    pieceSize,
    targetCenterX,
    targetCenterY,
    topLeftX,
    topLeftY,
    snapLayout,
    drag,
    pieceKey,
    onSnapConsumed,
  });
  usePieceFadeMotion({
    fadeInOnMount,
    fadeOut,
    restScale,
    opacity,
    scaleSV,
    onFadeOutComplete,
  });

  const transform = usePieceTransform({
    pieceSize,
    pieceKey,
    drag,
    topLeftX,
    topLeftY,
    scaleSV,
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

export const ChessBoardPieceSkia = memo(ChessBoardPieceSkiaImpl);
