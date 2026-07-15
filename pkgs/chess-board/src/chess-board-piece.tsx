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
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  clearDragMotion,
  type ChessBoardDragMotion,
} from './chess-board-drag-motion';
import { registerPieceLayout } from './chess-board-piece-layout-registry';

export const PIECE_DRAW_SCALE = 1.06;
/** Piece slide duration; keep capture ghost + capture SFX aligned with this. */
export const CHESS_PIECE_MOVE_MS = 200;
/**
 * Local Y (fraction of pieceSize from top) pinned to the pointer tip while
 * dragging. Lower → piece sits lower on the tip. Cburnett feet sit well above
 * the image bottom; 0.72 puts painted base on the tip (0.88 left a gap).
 * Shared with the portal drag preview so feet stay on the pointer.
 */
export const DRAG_FEET_FROM_TOP = 0.72;
const MOVE_MS = CHESS_PIECE_MOVE_MS;
const MOVE_EASING = Easing.out(Easing.cubic);

/** Stable sampling identity — avoids per-render object churn into CanvasKit. */
const PIECE_SAMPLING = {
  filter: FilterMode.Linear,
  mipmap: MipmapMode.Linear,
} as const;

export type ChessBoardPieceSkiaProps = {
  image: SkImage;
  pieceSize: number;
  targetCenterX: number;
  targetCenterY: number;
  /** When false, layout snaps instantly (performance). Default true. */
  animations?: boolean;
  /**
   * When true, the dragging piece is painted by the overlay portal — hide the
   * in-canvas copy so Skia's board-size clip does not cut it off.
   */
  hideWhileDragging?: boolean;
  /** Stable hash of piece row id — matches board drag.pieceKey while dragging. */
  pieceKey?: number;
  drag?: ChessBoardDragMotion;
  /** When true on next layout, seed position + clear board drag atomically. */
  snapLayout?: boolean;
  /** Stable board handler — must not be an inline lambda (breaks memo). */
  onSnapConsumed?: (pieceKey: number) => void;
};

type LayoutArgs = {
  pieceSize: number;
  targetCenterX: number;
  targetCenterY: number;
  topLeftX: SharedValue<number>;
  topLeftY: SharedValue<number>;
  snapLayout: boolean;
  animations: boolean;
  drag: ChessBoardDragMotion | undefined;
  pieceKey: number | undefined;
  onSnapConsumed: ((pieceKey: number) => void) | undefined;
};

function applySnapOrSeed(args: {
  nextX: number;
  nextY: number;
  snapLayout: boolean;
  drag: ChessBoardDragMotion | undefined;
  pieceKey: number | undefined;
  onSnapConsumed: ((pieceKey: number) => void) | undefined;
  topLeftX: SharedValue<number>;
  topLeftY: SharedValue<number>;
}): void {
  const {
    nextX,
    nextY,
    snapLayout,
    drag,
    pieceKey,
    onSnapConsumed,
    topLeftX,
    topLeftY,
  } = args;
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
  if (snapLayout && pieceKey !== undefined) onSnapConsumed?.(pieceKey);
}

function usePieceLayoutMotion(args: LayoutArgs): void {
  const {
    pieceSize,
    targetCenterX,
    targetCenterY,
    topLeftX,
    topLeftY,
    snapLayout,
    animations,
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
      applySnapOrSeed({
        nextX,
        nextY,
        snapLayout,
        drag,
        pieceKey,
        onSnapConsumed,
        topLeftX,
        topLeftY,
      });
      return;
    }
    // Already snapped via layout registry on drop — skip redundant withTiming.
    if (topLeftX.value === nextX && topLeftY.value === nextY) return;
    if (!animations) {
      topLeftX.value = nextX;
      topLeftY.value = nextY;
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
    animations,
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

function isPieceDragging(
  drag: ChessBoardDragMotion | undefined,
  pieceKey: number | undefined
): boolean {
  'worklet';
  return (
    drag !== undefined &&
    pieceKey !== undefined &&
    drag.pieceKey.value === pieceKey
  );
}

/**
 * Skia Group transforms apply right-to-left (last entry first on the point).
 * Drag: place visual feet on (tx, ty). Rest: center at rest mid.
 */
function usePieceTransform(args: {
  pieceSize: number;
  pieceKey: number | undefined;
  drag: ChessBoardDragMotion | undefined;
  topLeftX: SharedValue<number>;
  topLeftY: SharedValue<number>;
}) {
  const { pieceSize, pieceKey, drag, topLeftX, topLeftY } = args;
  return useDerivedValue(() => {
    const cx = pieceSize / 2;
    const cy = pieceSize / 2;
    const dragging = isPieceDragging(drag, pieceKey);
    const feetY = pieceSize * DRAG_FEET_FROM_TOP;
    const pivotY = dragging ? feetY : cy;
    const midX = dragging && drag ? drag.tx.value : topLeftX.value + cx;
    const midY = dragging && drag ? drag.ty.value : topLeftY.value + cy;
    return [
      { translateX: midX },
      { translateY: midY },
      { translateX: -cx },
      { translateY: -pivotY },
    ];
  });
}

function usePieceDragOpacity(args: {
  hideWhileDragging: boolean;
  drag: ChessBoardDragMotion | undefined;
  pieceKey: number | undefined;
}) {
  const { hideWhileDragging, drag, pieceKey } = args;
  return useDerivedValue(() => {
    if (!hideWhileDragging) return 1 as number;
    return (isPieceDragging(drag, pieceKey) ? 0 : 1) as number;
  });
}

function ChessBoardPieceSkiaImpl(props: ChessBoardPieceSkiaProps): ReactNode {
  const {
    image,
    pieceSize,
    targetCenterX,
    targetCenterY,
    animations = true,
    hideWhileDragging = false,
    pieceKey,
    drag,
    snapLayout = false,
    onSnapConsumed,
  } = props;

  const topLeftX = useSharedValue(targetCenterX - pieceSize / 2);
  const topLeftY = useSharedValue(targetCenterY - pieceSize / 2);

  useLayoutEffect(() => {
    if (pieceKey === undefined) return;
    return registerPieceLayout(pieceKey, {
      topLeftX,
      topLeftY,
      pieceSize,
    });
  }, [pieceKey, pieceSize, topLeftX, topLeftY]);

  usePieceLayoutMotion({
    pieceSize,
    targetCenterX,
    targetCenterY,
    topLeftX,
    topLeftY,
    snapLayout,
    animations,
    drag,
    pieceKey,
    onSnapConsumed,
  });

  const transform = usePieceTransform({
    pieceSize,
    pieceKey,
    drag,
    topLeftX,
    topLeftY,
  });
  const opacity = usePieceDragOpacity({
    hideWhileDragging,
    drag,
    pieceKey,
  });

  return (
    <Group transform={transform} opacity={opacity}>
      <Image
        image={image}
        x={0}
        y={0}
        width={pieceSize}
        height={pieceSize}
        sampling={PIECE_SAMPLING}
      />
    </Group>
  );
}

export const ChessBoardPieceSkia = memo(ChessBoardPieceSkiaImpl);
