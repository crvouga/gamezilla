import type { Chess } from 'chess.js';

import { indexFromSquare } from './chess-board-geometry';
import type { Piece, Position, Square } from './chess-board-types';

type ChessJsPiece = {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
};

function pieceFromChessJs(p: ChessJsPiece | null): Piece | null {
  if (p === null) return null;
  return { color: p.color, type: p.type };
}

/** Snapshot chess.js board into the flat 64-square Position used by the canvas. */
export function positionFromChess(chess: Chess): Position {
  const board = chess.board();
  const out: (Piece | null)[] = Array.from({ length: 64 }, () => null);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = (board[row]?.[col] ?? null) as ChessJsPiece | null;
      const file = String.fromCharCode('a'.charCodeAt(0) + col);
      const rank = String(8 - row);
      const square = `${file}${rank}` as Square;
      out[indexFromSquare(square)] = pieceFromChessJs(piece);
    }
  }
  return out;
}
