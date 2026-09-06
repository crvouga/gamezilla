import { Chess } from 'chess.js';

import { squareCenter, squareFromIndex } from './geometry';
import { pieceCode } from './piece-svgs';
import { positionFromChess } from './position';
import type { BoardOrientation, PieceCode, Square } from './types';

/** Default outer `testID` when ChessBoard is mounted without one. */
export const DEFAULT_CHESS_BOARD_TEST_ID = 'chess-board';

export function chessBoardPanTestId(boardTestId: string): string {
  return `${boardTestId}-pan`;
}

export function chessBoardTapTestId(boardTestId: string): string {
  return `${boardTestId}-tap`;
}

export function chessBoardProbeTestId(boardTestId: string): string {
  return `${boardTestId}-probe`;
}

export type ChessBoardProbePiece = {
  readonly square: Square;
  readonly piece: PieceCode;
  /** Board-local pixel center X. */
  readonly x: number;
  /** Board-local pixel center Y. */
  readonly y: number;
};

export type ChessBoardProbe = {
  readonly size: number;
  readonly orientation: BoardOrientation;
  readonly fen: string;
  readonly pieces: readonly ChessBoardProbePiece[];
};

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function buildChessBoardProbe(args: {
  readonly fen?: string;
  readonly size: number;
  readonly orientation: BoardOrientation;
}): ChessBoardProbe {
  const fen =
    args.fen !== undefined && args.fen.length > 0 ? args.fen : START_FEN;
  const chess = new Chess(fen);
  const position = positionFromChess(chess);
  const pieces: ChessBoardProbePiece[] = [];
  for (let i = 0; i < 64; i += 1) {
    const p = position[i];
    if (p === null || p === undefined) continue;
    const square = squareFromIndex(i);
    const code = pieceCode(p.color, p.type);
    if (code === null) continue;
    const center = squareCenter(square, args.size, args.orientation);
    pieces.push({
      square,
      piece: code,
      x: center.x,
      y: center.y,
    });
  }
  return {
    size: args.size,
    orientation: args.orientation,
    fen,
    pieces,
  };
}

export function parseChessBoardProbe(text: string | null): ChessBoardProbe {
  if (text === null || text.length === 0) {
    throw new Error('chess board probe: empty text');
  }
  const parsed = JSON.parse(text) as ChessBoardProbe;
  if (
    typeof parsed.size !== 'number' ||
    (parsed.orientation !== 'white' && parsed.orientation !== 'black') ||
    typeof parsed.fen !== 'string' ||
    !Array.isArray(parsed.pieces)
  ) {
    throw new Error('chess board probe: invalid shape');
  }
  return parsed;
}
