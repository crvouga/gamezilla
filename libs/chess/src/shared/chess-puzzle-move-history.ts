import { Chess } from 'chess.js';

import { applyUciToChessSan, tokenize } from './chess-puzzle-fsm';

export type PuzzleHistoryPly = {
  /** 0-based index into applied UCI tokens. */
  readonly plyIndex: number;
  /** `solveIdx` after this ply is applied (`plyIndex + 1`). */
  readonly solveIdxAfter: number;
  readonly san: string;
  readonly color: 'w' | 'b';
  /** Fullmove number shown before White's ply (chess convention). */
  readonly moveNumber: number;
};

/**
 * Rebuilds SAN plies for the puzzle line through `throughIdx` (exclusive),
 * matching {@link buildPuzzleFenTrail}'s index semantics.
 */
export function buildPuzzleMoveHistory(args: {
  fen: string;
  moves: string;
  throughIdx: number;
}): readonly PuzzleHistoryPly[] {
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
  const plies: PuzzleHistoryPly[] = [];
  for (let i = 0; i < end; i++) {
    const uci = tokens[i];
    if (uci === undefined) return plies;
    const moveNumber = chess.moveNumber();
    const color = chess.turn();
    const san = applyUciToChessSan(chess, uci);
    if (san === null) return plies;
    plies.push({
      plyIndex: i,
      solveIdxAfter: i + 1,
      san,
      color,
      moveNumber,
    });
  }
  return plies;
}
