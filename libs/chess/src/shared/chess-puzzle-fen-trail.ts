import { Chess } from 'chess.js';

import { applyUciToChess, tokenize } from './chess-puzzle-fsm';

/**
 * Rebuilds display FENs after each applied UCI ply from the puzzle start
 * through `throughIdx` (exclusive end index into `moves` tokens).
 *
 * Index 0 is the FEN after the opponent's opening move (token 0). Later
 * indices are after each subsequent token. An empty trail means the payload
 * could not be loaded / applied.
 */
export function buildPuzzleFenTrail(args: {
  fen: string;
  moves: string;
  throughIdx: number;
}): readonly string[] {
  const { fen, moves, throughIdx } = args;
  if (fen.length === 0 || moves.length === 0 || throughIdx <= 0) return [];

  const chess = new Chess();
  try {
    chess.load(fen);
  } catch {
    return [];
  }

  const tokens = tokenize(moves);
  const end = Math.min(throughIdx, tokens.length);
  const trail: string[] = [];
  for (let i = 0; i < end; i++) {
    const uci = tokens[i];
    if (uci === undefined) return trail;
    if (!applyUciToChess(chess, uci)) return trail;
    trail.push(chess.fen());
  }
  return trail;
}
