import { memo, type ReactNode } from 'react';
import { squareToXY } from './chess-board-geometry';
import { ChessBoardPieceSkia } from './chess-board-piece';
import type { BoardOrientation, PieceCode, Square } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';

type CaptureGhostLayerProps = {
  ghost: { square: Square; code: PieceCode } | null;
  pieceImages: PieceImageCache | null;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
};

/** Captured piece held in place for one slide duration. */
export const ChessBoardCaptureGhostLayer = memo(
  function ChessBoardCaptureGhostLayer(
    props: CaptureGhostLayerProps
  ): ReactNode {
    const { ghost, pieceImages, size, orientation, pieceDraw } = props;
    if (pieceImages === null || ghost === null) return null;
    const image = pieceImages[ghost.code];
    if (!image) return null;
    const cell = size / 8;
    const { x, y } = squareToXY(ghost.square, size, orientation);
    const cx = x + cell / 2 + cell * 0.042;
    const cy = y + cell / 2 + cell * 0.012;
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
