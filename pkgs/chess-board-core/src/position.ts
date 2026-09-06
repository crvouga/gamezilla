/** Flat 64-square {@link Position} snapshots and comparisons. */

import type { Chess } from 'chess.js';
import { indexFromSquare } from './geometry';
import type { Piece, Position, Square } from './types';

type ChessJsPiece = {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
};

function pieceFromChessJs(p: ChessJsPiece | null): Piece | null {
  if (p === null) return null;
  return { color: p.color, type: p.type };
}

/** Snapshot a chess.js board into the flat 64-square Position (index 0 = a1). */
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

export function pieceEq(a: Piece | null, b: Piece | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.color === b.color && a.type === b.type;
}

/** Stable string key for a position (board occupancy only, no side to move). */
export function positionKey(pos: Position): string {
  let s = '';
  for (let i = 0; i < 64; i++) {
    const p = pos[i];
    s += p ? `${p.color}${p.type}` : '-';
  }
  return s;
}

export function positionsEqual(a: Position, b: Position): boolean {
  return positionKey(a) === positionKey(b);
}
