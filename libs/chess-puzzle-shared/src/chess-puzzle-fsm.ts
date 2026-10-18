/**
 * Chess's spelling of a puzzle line: UCI tokens, their squares, and SAN as
 * the move list shows them. Setting a puzzle up, replaying and judging its
 * line are the platform's (`@libs/game-puzzle-shared/puzzle-setup`,
 * `puzzle-judge`), over chess's rules.
 */
import { playUci } from '@pkgs/chess-rules-shared/moves';
import { parseUci, tokenizeUciLine } from '@pkgs/chess-rules-shared/uci';
import type { Chess } from 'chess.js';

/** Side the human plays — fixed for the puzzle session, not derived from the live FEN. */
export type ChessPuzzleOrientation = 'white' | 'black';

/** Parses UCI `from`/`to` squares (ignores promotion suffix). */
export function uciToSquares(
  uci: string
): { readonly from: string; readonly to: string } | null {
  const parsed = parseUci(uci);
  return parsed === null ? null : { from: parsed.from, to: parsed.to };
}

/** Lower-cased UCI tokens; empty entries dropped. */
export function tokenize(movesStr: string): readonly string[] {
  return tokenizeUciLine(movesStr);
}

/**
 * Apply a UCI move to the given Chess instance in place. Returns the SAN when
 * the move was legal and applied; `null` for malformed UCI or illegal moves.
 * Castling entered as king-onto-rook is normalized by the rules kernel.
 */
export function applyUciToChessSan(chess: Chess, uci: string): string | null {
  return playUci(chess, uci);
}
