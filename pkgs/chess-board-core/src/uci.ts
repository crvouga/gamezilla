/**
 * Board-typed adapters over the `@pkgs/chess-rules` kernel, which owns UCI /
 * FEN parsing and move legality.
 */

import { sideToMoveOf } from '@pkgs/chess-rules/fen';
import { playUci } from '@pkgs/chess-rules/moves';
import { formatUci } from '@pkgs/chess-rules/uci';
import type { Chess } from 'chess.js';
import type { BoardOrientation, Move } from './types';

export function uciFromMove(
  m: Pick<Move, 'from' | 'to' | 'promotion'>
): string {
  return formatUci(m);
}

/** Side to move from a FEN string, as a board orientation. */
export function boardOrientationFromFen(fen: string): BoardOrientation {
  return sideToMoveOf(fen) === 'b' ? 'black' : 'white';
}

/** Apply a UCI move to a live chess.js instance; false when illegal. */
export function applyUci(chess: Chess, uci: string): boolean {
  return playUci(chess, uci) !== null;
}
