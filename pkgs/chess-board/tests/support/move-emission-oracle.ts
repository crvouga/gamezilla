import type { Move, Square } from '@pkgs/chess-board/chess-board-types';
import { type Chess, type Move as OracleMove, SQUARES } from 'chess.js';

/** Independent public chess.js output; no board-core conversion is reused. */
export function payloadOf(move: OracleMove): Move {
  const result: Move = { from: move.from, to: move.to, san: move.san };
  if (move.captured !== undefined) result.captured = move.captured;
  if (move.promotion !== undefined)
    result.promotion = move.promotion as NonNullable<Move['promotion']>;
  if (move.isEnPassant()) result.enPassant = true;
  if (move.isKingsideCastle())
    result.castle =
      move.color === 'w'
        ? { rookFrom: 'h1', rookTo: 'f1' }
        : { rookFrom: 'h8', rookTo: 'f8' };
  if (move.isQueensideCastle())
    result.castle =
      move.color === 'w'
        ? { rookFrom: 'a1', rookTo: 'd1' }
        : { rookFrom: 'a8', rookTo: 'd8' };
  return result;
}
export function paintedPieces(chess: Chess): string[] {
  return SQUARES.flatMap((square) => {
    const piece = chess.get(square);
    return piece === undefined ? [] : [`${piece.color}${piece.type}@${square}`];
  }).sort();
}
export function legalDestinations(
  chess: Chess,
  square: Square
): readonly Square[] {
  const result = new Set<Square>();
  for (const move of chess.moves({ square, verbose: true })) {
    result.add(move.to);
    if (move.isKingsideCastle()) result.add(move.color === 'w' ? 'h1' : 'h8');
    if (move.isQueensideCastle()) result.add(move.color === 'w' ? 'a1' : 'a8');
  }
  return [...result].sort();
}
