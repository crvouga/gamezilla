import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, type SharedValue } from 'react-native-reanimated';
import { ChessBoardPieceView } from './chess-board-piece-view';
import { xyToSquare } from './chess-board-geometry';
import type { ChessPieceRow } from './chess-board-piece-identities';
import type { BoardOrientation, Square } from './chess-board-types';
import { useStableHandler } from './use-stable-handler';

export type ChessBoardInteractionLayerProps = {
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  pieceRows: readonly ChessPieceRow[];
  hoverSquareIndex: SharedValue<number>;
  canDragFrom: (from: Square) => boolean;
  onDragStart: (from: Square) => void;
  onPanEnd: (from: Square, to: Square | null) => boolean;
  onSquareTap: (sq: Square) => void;
};

type BoardTapArgs = {
  size: number;
  orientation: BoardOrientation;
  onSquareTap: (sq: Square) => void;
};

function useBoardTapGesture(args: BoardTapArgs) {
  const { size, orientation, onSquareTap } = args;
  const tap = useStableHandler((sq: Square) => {
    onSquareTap(sq);
  });
  return useMemo(
    () =>
      Gesture.Tap().onEnd((e) => {
        const sq = xyToSquare(e.x, e.y, size, orientation);
        if (sq) runOnJS(tap)(sq);
      }),
    [orientation, size, tap]
  );
}

type PiecesProps = {
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  pieceRows: readonly ChessPieceRow[];
  hoverSquareIndex: SharedValue<number>;
  canDragFrom: (from: Square) => boolean;
  onDragStart: (from: Square) => void;
  onPanEnd: (from: Square, to: Square | null) => boolean;
  onSquareTap: (sq: Square) => void;
};

function PiecesOverlay(p: PiecesProps): ReactNode {
  return (
    <>
      {p.pieceRows.map((row) => (
        <ChessBoardPieceView
          key={row.id}
          row={row}
          size={p.size}
          orientation={p.orientation}
          pieceDraw={p.pieceDraw}
          dragDisabled={!p.canDragFrom(row.square)}
          hoverSquareIndex={p.hoverSquareIndex}
          onDragStart={p.onDragStart}
          onPanEnd={p.onPanEnd}
          onPress={p.onSquareTap}
        />
      ))}
    </>
  );
}

function ChessBoardInteractionLayerImpl(
  p: ChessBoardInteractionLayerProps
): ReactNode {
  const boardStyle = useMemo(
    () => ({ width: p.size, height: p.size }),
    [p.size]
  );
  const boardTap = useBoardTapGesture({
    size: p.size,
    orientation: p.orientation,
    onSquareTap: p.onSquareTap,
  });
  return (
    <View style={[styles.board, boardStyle]} pointerEvents="box-none">
      <GestureDetector gesture={boardTap}>
        <View style={styles.tapSurface} />
      </GestureDetector>
      <PiecesOverlay
        size={p.size}
        orientation={p.orientation}
        pieceDraw={p.pieceDraw}
        pieceRows={p.pieceRows}
        hoverSquareIndex={p.hoverSquareIndex}
        canDragFrom={p.canDragFrom}
        onDragStart={p.onDragStart}
        onPanEnd={p.onPanEnd}
        onSquareTap={p.onSquareTap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  tapSurface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

export const ChessBoardInteractionLayer = memo(
  ChessBoardInteractionLayerImpl
);
