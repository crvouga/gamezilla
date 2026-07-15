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
  DRAG_LIFT_MS,
  DRAG_LIFT_SCALE,
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

type DragKeyHit = { from: Square; idx: number; key: number };

function dragKeyAt(
  x: number,
  y: number,
  a: Pick<PanFactoryArgs, 'size' | 'orientation' | 'dragKeyTable'>
): DragKeyHit | null {
  'worklet';
  const from = xyToSquare(x, y, a.size, a.orientation);
  if (!from) return null;
  const idx = indexFromSquare(from);
  const key = a.dragKeyTable.value[idx] ?? DRAG_PIECE_NONE;
  if (key === DRAG_PIECE_NONE) return null;
  return { from, idx, key };
}

function beginDragAt(
  x: number,
  y: number,
  a: PanFactoryArgs
): boolean {
  'worklet';
  const hit = dragKeyAt(x, y, a);
  if (!hit) return false;
  const { drag } = a;
  a.panSettled.value = 0;
  drag.pieceKey.value = hit.key;
  drag.fromIndex.value = hit.idx;
  drag.tx.value = x;
  drag.ty.value = y;
  drag.scale.value = withTiming(DRAG_LIFT_SCALE, {
    duration: DRAG_LIFT_MS,
  });
  runOnJS(a.startDrag)(hit.from, hit.key);
  runOnJS(markChessPerf)('chess-drag-start-ui');
  return true;
}

function trackDragPointer(
  x: number,
  y: number,
  a: PanFactoryArgs
): void {
  'worklet';
  const { drag, size, orientation, hoverSquareIndex } = a;
  if (drag.pieceKey.value === DRAG_PIECE_NONE) return;
  drag.tx.value = x;
  drag.ty.value = y;
  const hover = xyToSquare(x, y, size, orientation);
  hoverSquareIndex.value = hover ? indexFromSquare(hover) : HOVER_NONE;
}

function createBoardPanGesture(a: PanFactoryArgs) {
  const { drag, hoverSquareIndex } = a;
  return Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, state) => {
      const t = e.allTouches[0];
      if (!t || !beginDragAt(t.x, t.y, a)) {
        state.fail();
        return;
      }
      // Activate immediately so drag state is not deferred until movement.
      state.activate();
    })
    .onTouchesMove((e) => {
      const t = e.allTouches[0];
      if (t) trackDragPointer(t.x, t.y, a);
    })
    .onUpdate((e) => {
      trackDragPointer(e.x, e.y, a);
    })
    .onEnd((e) => {
      const key = drag.pieceKey.value;
      const fromIdx = drag.fromIndex.value;
      if (key === DRAG_PIECE_NONE || fromIdx === HOVER_NONE) return;
      a.panSettled.value = 1;
      const from = squareFromIndex(fromIdx);
      const to = xyToSquare(e.x, e.y, a.size, a.orientation);
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
