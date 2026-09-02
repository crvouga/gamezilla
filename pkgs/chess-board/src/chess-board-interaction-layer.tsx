import { Box } from '@pkgs/ui';
import { memo, type ReactNode, useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  type SharedValue,
  useSharedValue,
} from 'react-native-reanimated';
import {
  type ChessBoardDragMotion,
  clearDragMotion,
  DRAG_PIECE_NONE,
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
  /** RNGH pan gesture test id (`${boardTestId}-pan`). */
  panTestId: string;
  /** RNGH tap gesture test id (`${boardTestId}-tap`). */
  tapTestId: string;
  hoverSquareIndex: SharedValue<number>;
  legalMarkersOpacity: SharedValue<number>;
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
  panTestId: string;
  hoverSquareIndex: SharedValue<number>;
  legalMarkersOpacity: SharedValue<number>;
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

function beginDragAt(x: number, y: number, a: PanFactoryArgs): boolean {
  'worklet';
  const hit = dragKeyAt(x, y, a);
  if (!hit) return false;
  const { drag } = a;
  a.panSettled.value = 0;
  drag.pieceKey.value = hit.key;
  drag.fromIndex.value = hit.idx;
  drag.tx.value = x;
  drag.ty.value = y;
  a.legalMarkersOpacity.value = 1;
  runOnJS(a.startDrag)(hit.from, hit.key);
  runOnJS(markChessPerf)('chess-drag-start-ui');
  return true;
}

function trackDragPointer(x: number, y: number, a: PanFactoryArgs): void {
  'worklet';
  const { drag, size, orientation, hoverSquareIndex } = a;
  if (drag.pieceKey.value === DRAG_PIECE_NONE) return;
  drag.tx.value = x;
  drag.ty.value = y;
  const hover = xyToSquare(x, y, size, orientation);
  hoverSquareIndex.value = hover ? indexFromSquare(hover) : HOVER_NONE;
}

/** Re-export gesture id helpers used by black-box tests. */
export {
  chessBoardPanTestId,
  chessBoardTapTestId,
} from './chess-board-probe';

function createBoardPanGesture(a: PanFactoryArgs) {
  const { drag, hoverSquareIndex, legalMarkersOpacity, panTestId } = a;
  return Gesture.Pan()
    .withTestId(panTestId)
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
    .onStart((e) => {
      // Jest fireGestureHandler activates without onTouchesDown; seed drag
      // from the start event so black-box pointer streams still work.
      if (drag.pieceKey.value === DRAG_PIECE_NONE) {
        beginDragAt(e.x, e.y, a);
      }
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
      legalMarkersOpacity.value = 0;
      runOnJS(a.endDrag)(from, to, key);
    })
    .onFinalize(() => {
      if (a.panSettled.value === 0 && drag.pieceKey.value !== DRAG_PIECE_NONE) {
        clearDragMotion(drag);
        hoverSquareIndex.value = HOVER_NONE;
        legalMarkersOpacity.value = 0;
        runOnJS(a.cancelDrag)();
      }
    });
}

function useBoardGestures(args: ChessBoardInteractionLayerProps) {
  const startDrag = useStableHandler((from: Square, pieceKey: number) => {
    args.onDragStart(from, pieceKey);
  });
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
  const {
    size,
    orientation,
    panTestId,
    tapTestId,
    hoverSquareIndex,
    legalMarkersOpacity,
    drag,
    dragKeyTable,
  } = args;

  return useMemo(() => {
    const pan = createBoardPanGesture({
      size,
      orientation,
      panTestId,
      hoverSquareIndex,
      legalMarkersOpacity,
      drag,
      dragKeyTable,
      panSettled,
      startDrag,
      endDrag,
      cancelDrag,
    });
    const tap = Gesture.Tap()
      .withTestId(tapTestId)
      .onEnd((e) => {
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
    legalMarkersOpacity,
    orientation,
    panSettled,
    panTestId,
    size,
    startDrag,
    tapSquare,
    tapTestId,
  ]);
}

function ChessBoardInteractionLayerImpl(
  p: ChessBoardInteractionLayerProps
): ReactNode {
  const gesture = useBoardGestures(p);
  return (
    <Box
      pointerEvents="box-none"
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: p.size,
        height: p.size,
      }}
    >
      <GestureDetector gesture={gesture}>
        <Box sx={{ absoluteFill: true }} />
      </GestureDetector>
    </Box>
  );
}

export const ChessBoardInteractionLayer = memo(ChessBoardInteractionLayerImpl);
