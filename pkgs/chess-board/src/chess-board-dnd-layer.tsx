import { memo, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Droppable, DropProvider } from 'react-native-reanimated-dnd';
import { ChessBoardDraggablePiece } from './chess-board-draggable-piece';
import type { ChessPieceDragData } from './chess-board-dnd-types';
import { squareToXY } from './chess-board-geometry';
import type { BoardOrientation, Square } from './chess-board-types';
import { ALL_BOARD_SQUARES } from './use-chess-board-dnd';

const DROP_CAPACITY = 64;

export type ChessBoardDndLayerProps = {
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  dragData: readonly ChessPieceDragData[];
  remountKeys: Readonly<Record<string, number>>;
  canDragFrom: (from: Square) => boolean;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onDropToSquare: (from: Square, to: Square) => void;
  onSquareTap: (sq: Square) => void;
  onHoverChange: (sq: Square, active: boolean) => void;
};

type SquareCellProps = {
  sq: Square;
  size: number;
  orientation: BoardOrientation;
  onDropToSquare: (from: Square, to: Square) => void;
  onSquareTap: (sq: Square) => void;
  onHoverChange: (sq: Square, active: boolean) => void;
};

function SquareDropCell(p: SquareCellProps): ReactNode {
  const { x, y, cell } = squareToXY(p.sq, p.size, p.orientation);
  return (
    <Droppable
      droppableId={p.sq}
      capacity={DROP_CAPACITY}
      onDrop={(data: ChessPieceDragData) => p.onDropToSquare(data.from, p.sq)}
      onActiveChange={(active) => p.onHoverChange(p.sq, active)}
      style={[styles.cell, { left: x, top: y, width: cell, height: cell }]}
    >
      <Pressable
        style={styles.fill}
        onPress={() => p.onSquareTap(p.sq)}
      />
    </Droppable>
  );
}

type PiecesOverlayProps = {
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  dragData: readonly ChessPieceDragData[];
  remountKeys: Readonly<Record<string, number>>;
  canDragFrom: (from: Square) => boolean;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onSquareTap: (sq: Square) => void;
};

function PiecesOverlay(p: PiecesOverlayProps): ReactNode {
  return (
    <>
      {p.dragData.map((data) => {
        const remountKey = p.remountKeys[data.id] ?? 0;
        return (
          <ChessBoardDraggablePiece
            key={`${data.id}-${remountKey}`}
            data={data}
            size={p.size}
            orientation={p.orientation}
            pieceDraw={p.pieceDraw}
            dragDisabled={!p.canDragFrom(data.from)}
            onDragStart={p.onDragStart}
            onDragEnd={p.onDragEnd}
            onPress={p.onSquareTap}
          />
        );
      })}
    </>
  );
}

function ChessBoardDndLayerImpl(p: ChessBoardDndLayerProps): ReactNode {
  const boardStyle = useMemo(
    () => ({ width: p.size, height: p.size }),
    [p.size]
  );
  return (
    <DropProvider>
      <View style={[styles.board, boardStyle]} pointerEvents="box-none">
        {ALL_BOARD_SQUARES.map((sq) => (
          <SquareDropCell
            key={sq}
            sq={sq}
            size={p.size}
            orientation={p.orientation}
            onDropToSquare={p.onDropToSquare}
            onSquareTap={p.onSquareTap}
            onHoverChange={p.onHoverChange}
          />
        ))}
        <PiecesOverlay
          size={p.size}
          orientation={p.orientation}
          pieceDraw={p.pieceDraw}
          dragData={p.dragData}
          remountKeys={p.remountKeys}
          canDragFrom={p.canDragFrom}
          onDragStart={p.onDragStart}
          onDragEnd={p.onDragEnd}
          onSquareTap={p.onSquareTap}
        />
      </View>
    </DropProvider>
  );
}

const styles = StyleSheet.create({
  board: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cell: {
    position: 'absolute',
    zIndex: 1,
  },
  fill: {
    flex: 1,
  },
});

export const ChessBoardDndLayer = memo(ChessBoardDndLayerImpl);
