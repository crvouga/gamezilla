/**
 * Spoken move / position announcements for screen readers (ARIA live region).
 * Pure string builders — the Solid host wires `aria-live`.
 */

import type { Move, Piece, PieceType, Position, Square } from '../types';

const PIECE_NAMES: Record<PieceType, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

export function pieceName(type: PieceType): string {
  return PIECE_NAMES[type] ?? 'Piece';
}

/** e.g. "Knight takes e5, check" / "Pawn e4". */
export function speakMove(args: {
  readonly move: Move;
  readonly piece: Piece | null;
  readonly inCheck: boolean;
  readonly isCheckmate: boolean;
}): string {
  const name =
    args.piece !== null ? pieceName(args.piece.type) : 'Piece';
  const capture =
    args.move.captured !== undefined
      ? ` takes ${args.move.to}`
      : ` to ${args.move.to}`;
  let s = `${name}${capture}`;
  if (args.move.promotion !== undefined) {
    s += `, promotes to ${pieceName(args.move.promotion)}`;
  }
  if (args.move.castle !== undefined) {
    s =
      args.move.to.charCodeAt(0) > args.move.from.charCodeAt(0)
        ? 'King castles kingside'
        : 'King castles queenside';
  }
  if (args.isCheckmate) return `${s}, checkmate`;
  if (args.inCheck) return `${s}, check`;
  return s;
}

/** Compact board description for "describe position". */
export function describePosition(position: Position, turn: 'w' | 'b'): string {
  const parts: string[] = [];
  for (let i = 0; i < 64; i += 1) {
    const p = position[i];
    if (p === null || p === undefined) continue;
    const sq = `${String.fromCharCode(97 + (i % 8))}${String.fromCharCode(49 + Math.floor(i / 8))}` as Square;
    parts.push(
      `${p.color === 'w' ? 'White' : 'Black'} ${pieceName(p.type)} on ${sq}`
    );
  }
  const side = turn === 'w' ? 'White' : 'Black';
  return `${side} to move. ${parts.join('. ')}.`;
}
