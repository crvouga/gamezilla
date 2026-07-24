import type { Chess } from 'chess.js';

import { inferLastMoveFromPositionDiff } from './chess-board-piece-identities';
import { positionFromChess } from './chess-board-position-from-chess';
import type { Move } from './chess-board-types';

export type ApplyExternalFenResult = {
  moved: Move | null;
  inCheck: boolean;
  isGameOver: boolean;
};

/**
 * Loads an external FEN onto a live chess.js instance. Same-FEN is a no-op.
 * When the new position is a single ply away, returns that move for SFX /
 * last-move highlights (controlled boards, puzzle opponent staging).
 */
export function applyExternalFenToChess(
  chess: Chess,
  nextFen: string
): ApplyExternalFenResult | null {
  if (nextFen === chess.fen()) return null;
  const prev = positionFromChess(chess);
  chess.load(nextFen);
  const moved = inferLastMoveFromPositionDiff(prev, positionFromChess(chess));
  return {
    moved,
    inCheck: chess.inCheck(),
    isGameOver: chess.isGameOver(),
  };
}
