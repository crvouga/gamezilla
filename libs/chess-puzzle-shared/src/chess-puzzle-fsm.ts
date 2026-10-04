import { parseFen, sideToMoveOf } from '@pkgs/chess-rules-shared/fen';
import { playUci } from '@pkgs/chess-rules-shared/moves';
import { parseUci, tokenizeUciLine } from '@pkgs/chess-rules-shared/uci';
import { Chess } from 'chess.js';

/** Side the human plays — fixed for the puzzle session, not derived from the live FEN. */
export type ChessPuzzleOrientation = 'white' | 'black';

/** Promotion piece char accepted by chess.js' UCI move format. */
export type ChessPuzzlePromotion = 'q' | 'r' | 'b' | 'n';

export type ChessPuzzleSetupReady = {
  readonly kind: 'ready';
  readonly tokens: readonly string[];
  /** FEN after the opponent's first move was applied; this is what the host plays from. */
  readonly displayFen: string;
  readonly orientation: ChessPuzzleOrientation;
  /** `'solved'` if the puzzle has only one token (opening move with no human reply). */
  readonly status: 'solving' | 'solved';
};

export type ChessPuzzleSetupResult =
  | ChessPuzzleSetupReady
  | { readonly kind: 'invalid' };

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

/** Side-to-move from FEN's second field; defaults to white when missing. */
export function boardOrientationFromFen(fen: string): ChessPuzzleOrientation {
  return sideToMoveOf(fen) === 'b' ? 'black' : 'white';
}

/**
 * Apply a UCI move to the given Chess instance in place. Returns the SAN when
 * the move was legal and applied; `null` for malformed UCI or illegal moves.
 * Castling entered as king-onto-rook is normalized by the rules kernel.
 */
export function applyUciToChessSan(chess: Chess, uci: string): string | null {
  return playUci(chess, uci);
}

/**
 * Apply a UCI move to the given Chess instance in place. Returns `true` when
 * the move was legal and applied; `false` for malformed UCI or illegal moves.
 */
export function applyUciToChess(chess: Chess, uci: string): boolean {
  return playUci(chess, uci) !== null;
}

/**
 * Validates `fen` + `moves`, applies the opponent's first move, and returns
 * the post-opening state ready for the human's first reply. Returns
 * `{ kind: 'invalid' }` for any parse / load / move failure so the FSM can
 * surface a single terminal `invalid` status to clients.
 */
export function setupPuzzleStart(
  fen: string,
  moves: string
): ChessPuzzleSetupResult {
  if (fen.length === 0 || moves.length === 0) return { kind: 'invalid' };
  if (!parseFen(fen).ok) return { kind: 'invalid' };
  const chess = new Chess(fen);

  const tokens = tokenize(moves);
  const first = tokens[0];
  if (first === undefined) return { kind: 'invalid' };
  if (!applyUciToChess(chess, first)) return { kind: 'invalid' };

  const displayFen = chess.fen();
  return {
    kind: 'ready',
    tokens,
    displayFen,
    orientation: boardOrientationFromFen(displayFen),
    status: tokens.length <= 1 ? 'solved' : 'solving',
  };
}
