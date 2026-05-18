import { Group } from '@shopify/react-native-skia';
import { memo, type ReactNode } from 'react';
import { squareToXY } from './chess-board-geometry';
import { ChessBoardPieceSkia } from './chess-board-piece';
import type { ChessPieceRow } from './chess-board-piece-identities';
import type { BoardOrientation, PieceCode, Square } from './chess-board-types';
import type { PieceImageCache } from './chess-pieces-cache';

type PiecesLayerProps = {
  pieceRows: readonly ChessPieceRow[];
  dragFrom: Square | null;
  pieceImages: PieceImageCache | null;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
};

/** Active pieces. Memoized so hover/selection state changes don't reconcile pieces. */
export const ChessBoardPiecesLayer = memo(function ChessBoardPiecesLayer(
  props: PiecesLayerProps
): ReactNode {
  const { pieceRows, dragFrom, pieceImages, size, orientation, pieceDraw } =
    props;
  if (pieceImages === null) return null;
  const cell = size / 8;
  return (
    <Group>
      {pieceRows.map((row) => {
        if (dragFrom === row.square) return null;
        const { x, y } = squareToXY(row.square, size, orientation);
        const cx = x + cell / 2 + cell * 0.042;
        const cy = y + cell / 2 + cell * 0.012;
        const image = pieceImages[row.code];
        return (
          <ChessBoardPieceSkia
            key={row.id}
            image={image}
            pieceSize={pieceDraw}
            targetCenterX={cx}
            targetCenterY={cy}
            fadeInOnMount={row.fadeIn === true}
          />
        );
      })}
    </Group>
  );
});

type CaptureGhostLayerProps = {
  ghost: { square: Square; code: PieceCode } | null;
  pieceImages: PieceImageCache | null;
  size: number;
  orientation: BoardOrientation;
  pieceDraw: number;
};

/** Captured piece held in place for one slide duration; isolated layer so its
 * timer doesn't reconcile the whole pieces tree. */
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
