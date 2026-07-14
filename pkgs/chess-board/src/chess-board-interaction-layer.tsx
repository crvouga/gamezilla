import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  clearDragMotion,
  DRAG_PIECE_NONE,
  type ChessBoardDragMotion,
} from './chess-board-drag-motion';
import {
  HOVER_NONE,
  indexFromSquare,
  squareFromIndex,
  xyToSquare,
} from './chess-board-geometry';
import { markChessPerf } from './chess-board-perf';
import type { BoardOrientation, Square } from './chess-board-types';
import { useStableHandler } from './use-stable-handler';

const DRAG_SCALE = 1.18;
const DRAG_SCALE_MS = 100;

export type ChessBoardInteractionLayerProps = {
  size: number;
  orientation: BoardOrientation;
  hoverSquareIndex: SharedValue<number>;
  drag: ChessBoardDragMotion;
  dragKeyTable: SharedValue<number[]>;
  onDragStart: (from: Square, pieceKey: number) => void;
  onPanEnd: (from: Square, to: Square | null, pieceKey: number) => boolean;
  onSquareTap: (sq: Square) => void;
  onDragCancel: () => void;
};

type PanFactoryArgs = {
  size: number;
  orientation: BoardOrientation;
  hoverSquareIndex: SharedValue<number>;
  drag: ChessBoardDragMotion;
  dragKeyTable: SharedValue<number[]>;
  panSettled: SharedValue<number>;
  startDrag: (from: Square, pieceKey: number) => void;
  endDrag: (from: Square, to: Square | null, pieceKey: number) => void;
  cancelDrag: () => void;
};

function createBoardPanGesture(a: PanFactoryArgs) {
  const { size, orientation, hoverSquareIndex, drag, dragKeyTable } = a;
  return Gesture.Pan()
    .onStart((e) => {
      const from = xyToSquare(e.x, e.y, size, orientation);
      if (!from) return;
      const idx = indexFromSquare(from);
      const key = dragKeyTable.value[idx] ?? DRAG_PIECE_NONE;
      if (key === DRAG_PIECE_NONE) return;
      a.panSettled.value = 0;
      drag.pieceKey.value = key;
      drag.fromIndex.value = idx;
      drag.tx.value = 0;
      drag.ty.value = 0;
      drag.scale.value = withTiming(DRAG_SCALE, { duration: DRAG_SCALE_MS });
      runOnJS(a.startDrag)(from, key);
      runOnJS(markChessPerf)('chess-drag-start-ui');
    })
    .onUpdate((e) => {
      if (drag.pieceKey.value === DRAG_PIECE_NONE) return;
      drag.tx.value = e.translationX;
      drag.ty.value = e.translationY;
      const hover = xyToSquare(e.x, e.y, size, orientation);
      hoverSquareIndex.value = hover ? indexFromSquare(hover) : HOVER_NONE;
    })
    .onEnd((e) => {
      const key = drag.pieceKey.value;
      const fromIdx = drag.fromIndex.value;
      if (key === DRAG_PIECE_NONE || fromIdx === HOVER_NONE) return;
      a.panSettled.value = 1;
      const from = squareFromIndex(fromIdx);
      const to = xyToSquare(e.x, e.y, size, orientation);
      hoverSquareIndex.value = HOVER_NONE;
      runOnJS(a.endDrag)(from, to, key);
    })
    .onFinalize(() => {
      if (
        a.panSettled.value === 0 &&
        drag.pieceKey.value !== DRAG_PIECE_NONE
      ) {
        clearDragMotion(drag);
        hoverSquareIndex.value = HOVER_NONE;
        runOnJS(a.cancelDrag)();
      }
    });
}

function useBoardGestures(args: ChessBoardInteractionLayerProps) {
  const startDrag = useStableHandler(
    (from: Square, pieceKey: number) => {
      args.onDragStart(from, pieceKey);
    }
  );
  const endDrag = useStableHandler(
    (from: Square, to: Square | null, pieceKey: number) => {
      args.onPanEnd(from, to, pieceKey);
    }
  );
  const tapSquare = useStableHandler((sq: Square) => {
    args.onSquareTap(sq);
  });
  const cancelDrag = useStableHandler(() => {
    args.onDragCancel();
  });
  const panSettled = useSharedValue(0);
  const { size, orientation, hoverSquareIndex, drag, dragKeyTable } = args;

  return useMemo(() => {
    const pan = createBoardPanGesture({
      size,
      orientation,
      hoverSquareIndex,
      drag,
      dragKeyTable,
      panSettled,
      startDrag,
      endDrag,
      cancelDrag,
    });
    const tap = Gesture.Tap().onEnd((e) => {
      if (drag.pieceKey.value !== DRAG_PIECE_NONE) return;
      const sq = xyToSquare(e.x, e.y, size, orientation);
      if (sq) runOnJS(tapSquare)(sq);
    });
    return Gesture.Exclusive(pan, tap);
  }, [
    cancelDrag,
    drag,
    dragKeyTable,
    endDrag,
    hoverSquareIndex,
    orientation,
    panSettled,
    size,
    startDrag,
    tapSquare,
  ]);
}

function ChessBoardInteractionLayerImpl(
  p: ChessBoardInteractionLayerProps
): ReactNode {
  const boardStyle = useMemo(
    () => ({ width: p.size, height: p.size }),
    [p.size]
  );
  const gesture = useBoardGestures(p);
  return (
    <View style={[styles.board, boardStyle]} pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <View style={styles.surface} />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  surface: {
    ...StyleSheet.absoluteFillObject,
  },
});

export const ChessBoardInteractionLayer = memo(
  ChessBoardInteractionLayerImpl
);
