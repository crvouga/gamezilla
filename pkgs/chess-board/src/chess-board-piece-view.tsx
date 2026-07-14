import { memo, useMemo, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import {
  HOVER_NONE,
  indexFromSquare,
  squareToXY,
  xyToSquare,
} from './chess-board-geometry';
import type { ChessPieceRow } from './chess-board-piece-identities';
import { PIECE_SVGS } from './chess-pieces-svg';
import type { BoardOrientation, Square } from './chess-board-types';
import { useChessBoardPieceMotion } from './use-chess-board-piece-motion';
import { useStableHandler } from './use-stable-handler';

const DRAG_SCALE = 1.22;
const REST_Z = 2;
const DRAG_Z = 1000;
const DRAG_ELEVATION = 24;

export type ChessBoardPieceViewProps = {
  row: ChessPieceRow;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  dragDisabled: boolean;
  hoverSquareIndex: SharedValue<number>;
  onDragStart: (from: Square) => void;
  onPanEnd: (from: Square, to: Square | null) => boolean;
  onPress: (from: Square) => void;
};

type PieceMotionSVs = {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  leftSV: SharedValue<number>;
  topSV: SharedValue<number>;
  scaleSV: SharedValue<number>;
  zSV: SharedValue<number>;
  elevSV: SharedValue<number>;
};

type PanBuildersArgs = {
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  dragDisabled: boolean;
  hoverSquareIndex: SharedValue<number>;
  sv: PieceMotionSVs;
  startDrag: () => void;
  finishPan: (to: Square | null) => void;
};

function buildPiecePanGesture(args: PanBuildersArgs) {
  const { size, orientation, pieceDraw, dragDisabled, hoverSquareIndex } =
    args;
  const { tx, ty, leftSV, topSV, scaleSV, zSV, elevSV } = args.sv;
  return Gesture.Pan()
    .enabled(!dragDisabled)
    .minDistance(2)
    .onStart(() => {
      zSV.value = DRAG_Z;
      elevSV.value = DRAG_ELEVATION;
      scaleSV.value = withSpring(DRAG_SCALE, {
        damping: 16,
        stiffness: 220,
      });
      runOnJS(args.startDrag)();
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      const hx = leftSV.value + pieceDraw / 2 + e.translationX;
      const hy = topSV.value + pieceDraw / 2 + e.translationY;
      const sq = xyToSquare(hx, hy, size, orientation);
      hoverSquareIndex.value = sq ? indexFromSquare(sq) : HOVER_NONE;
    })
    .onEnd((e) => {
      const hx = leftSV.value + pieceDraw / 2 + e.translationX;
      const hy = topSV.value + pieceDraw / 2 + e.translationY;
      const to = xyToSquare(hx, hy, size, orientation);
      // Keep tx/ty until layout seeds destination (avoids origin flash).
      zSV.value = REST_Z;
      elevSV.value = 0;
      scaleSV.value = withSpring(1, { damping: 16, stiffness: 220 });
      hoverSquareIndex.value = HOVER_NONE;
      runOnJS(args.finishPan)(to);
    })
    .onFinalize(() => {
      hoverSquareIndex.value = HOVER_NONE;
    });
}

type GestureArgs = {
  from: Square;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  dragDisabled: boolean;
  hoverSquareIndex: SharedValue<number>;
  sv: PieceMotionSVs;
  markSnapAfterDrag: () => void;
  onDragStart: (from: Square) => void;
  onPanEnd: (from: Square, to: Square | null) => boolean;
  onPress: (from: Square) => void;
};

function usePieceGestures(args: GestureArgs) {
  const finishPan = useStableHandler((to: Square | null) => {
    const { tx, ty, leftSV, topSV } = args.sv;
    const applied = args.onPanEnd(args.from, to);
    if (applied) {
      // Fold drag offset into layout so we never flash to origin while
      // waiting for React (or when promotion keeps square === from).
      leftSV.value = leftSV.value + tx.value;
      topSV.value = topSV.value + ty.value;
      tx.value = 0;
      ty.value = 0;
      args.markSnapAfterDrag();
      return;
    }
    // Illegal / same-square: snap translate back to origin layout.
    tx.value = 0;
    ty.value = 0;
  });
  const startDrag = useStableHandler(() => {
    args.onDragStart(args.from);
  });
  const press = useStableHandler(() => {
    args.onPress(args.from);
  });
  const { size, orientation, pieceDraw, dragDisabled, hoverSquareIndex, sv } =
    args;
  const { tx, ty, leftSV, topSV, scaleSV, zSV, elevSV } = sv;

  return useMemo(() => {
    const pan = buildPiecePanGesture({
      size,
      orientation,
      pieceDraw,
      dragDisabled,
      hoverSquareIndex,
      sv: { tx, ty, leftSV, topSV, scaleSV, zSV, elevSV },
      startDrag,
      finishPan,
    });
    const tap = Gesture.Tap().onEnd(() => {
      runOnJS(press)();
    });
    return Gesture.Exclusive(pan, tap);
  }, [
    dragDisabled,
    elevSV,
    finishPan,
    hoverSquareIndex,
    leftSV,
    orientation,
    pieceDraw,
    press,
    scaleSV,
    size,
    startDrag,
    topSV,
    tx,
    ty,
    zSV,
  ]);
}

function ChessBoardPieceViewImpl(p: ChessBoardPieceViewProps): ReactNode {
  const { x, y, cell } = squareToXY(p.row.square, p.size, p.orientation);
  const pad = (cell - p.pieceDraw) / 2;
  const motion = useChessBoardPieceMotion({
    left: x + pad,
    top: y + pad,
  });
  const sv: PieceMotionSVs = {
    tx: motion.tx,
    ty: motion.ty,
    leftSV: motion.leftSV,
    topSV: motion.topSV,
    scaleSV: motion.scaleSV,
    zSV: motion.zSV,
    elevSV: motion.elevSV,
  };
  const gesture = usePieceGestures({
    from: p.row.square,
    size: p.size,
    orientation: p.orientation,
    pieceDraw: p.pieceDraw,
    dragDisabled: p.dragDisabled,
    hoverSquareIndex: p.hoverSquareIndex,
    sv,
    markSnapAfterDrag: motion.markSnapAfterDrag,
    onDragStart: p.onDragStart,
    onPanEnd: p.onPanEnd,
    onPress: p.onPress,
  });
  const xml = PIECE_SVGS[p.row.code];
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          motion.wrapStyle,
          { width: p.pieceDraw, height: p.pieceDraw },
        ]}
      >
        <Animated.View style={motion.liftStyle}>
          <SvgXml xml={xml} width={p.pieceDraw} height={p.pieceDraw} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export const ChessBoardPieceView = memo(ChessBoardPieceViewImpl);
