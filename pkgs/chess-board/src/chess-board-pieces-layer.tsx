import { memo, useMemo, type ReactNode } from 'react';
import { squarePieceCenter } from './chess-board-geometry';
import type { ChessBoardDragMotion } from './chess-board-drag-motion';
import { hashPieceId } from './chess-board-drag-motion';
import { ChessBoardPieceSkia } from './chess-board-piece';
import type { ChessPieceRow } from './chess-board-piece-identities';
import type { BoardOrientation, PieceCode, Square } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';

type CaptureGhostLayerProps = {
  ghost: { square: Square; code: PieceCode } | null;
  pieceImages: PieceImageCache | null;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
};

/** Captured piece held under the sliding attacker for MOVE_MS. */
export const ChessBoardCaptureGhostLayer = memo(
  function ChessBoardCaptureGhostLayer(
    props: CaptureGhostLayerProps
  ): ReactNode {
    const { ghost, pieceImages, size, orientation, pieceDraw } = props;
    if (pieceImages === null || ghost === null) return null;
    const image = pieceImages[ghost.code];
    if (!image) return null;
    const { x: cx, y: cy } = squarePieceCenter(
      ghost.square,
      size,
      orientation
    );
    return (
      <ChessBoardPieceSkia
        key="capture-ghost"
        image={image}
        pieceSize={pieceDraw}
        targetCenterX={cx}
        targetCenterY={cy}
      />
    );
  }
);

export type ChessBoardPiecesLayerProps = {
  pieceRows: readonly ChessPieceRow[];
  pieceImages: PieceImageCache | null;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
  /** Square of the piece currently dragging — painted last for z-order. */
  dragFrom: Square | null;
  drag: ChessBoardDragMotion;
  snapKeys: ReadonlySet<number>;
  onSnapConsumed: (pieceKey: number) => void;
  animations: boolean;
  /** Prefer portal drag preview — hide the in-canvas dragging piece. */
  hideDraggingPiece: boolean;
};

function orderRowsForDrag(
  rows: readonly ChessPieceRow[],
  dragFrom: Square | null
): readonly ChessPieceRow[] {
  if (dragFrom === null) return rows;
  const dragging: ChessPieceRow[] = [];
  const rest: ChessPieceRow[] = [];
  for (const row of rows) {
    if (row.square === dragFrom) dragging.push(row);
    else rest.push(row);
  }
  return dragging.length === 0 ? rows : [...rest, ...dragging];
}

function ChessBoardPiecesLayerImpl(
  props: ChessBoardPiecesLayerProps
): ReactNode {
  const {
    pieceRows,
    pieceImages,
    size,
    orientation,
    pieceDraw,
    dragFrom,
    drag,
    snapKeys,
    onSnapConsumed,
    animations,
    hideDraggingPiece,
  } = props;
  const ordered = useMemo(
    () => orderRowsForDrag(pieceRows, dragFrom),
    [pieceRows, dragFrom]
  );
  if (pieceImages === null) return null;
  return (
    <>
      {ordered.map((row) => {
        const image = pieceImages[row.code];
        if (!image) return null;
        const { x: cx, y: cy } = squarePieceCenter(
          row.square,
          size,
          orientation
        );
        const key = hashPieceId(row.id);
        return (
          <ChessBoardPieceSkia
            key={row.id}
            image={image}
            pieceSize={pieceDraw}
            targetCenterX={cx}
            targetCenterY={cy}
            pieceKey={key}
            drag={drag}
            snapLayout={snapKeys.has(key)}
            onSnapConsumed={onSnapConsumed}
            animations={animations}
            hideWhileDragging={hideDraggingPiece && dragFrom !== null}
          />
        );
      })}
    </>
  );
}

export const ChessBoardPiecesLayer = memo(ChessBoardPiecesLayerImpl);
