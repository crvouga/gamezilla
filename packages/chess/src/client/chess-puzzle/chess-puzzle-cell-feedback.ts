import { deriveCurrentPlayCounts } from '../../shared/chess-puzzle-derive';
import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import type { CellFeedback, Square } from '../chess-board/chess-board-types';
import type { SolveStatus } from './use-chess-puzzle-solver';

export function deriveChessPuzzleCellFeedback(args: {
  status: SolveStatus;
  puzzleId: string;
  interactions: readonly ChessPuzzleInteractionRow[];
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  showSolvedCrownOn: Square | null;
}): Partial<Record<Square, CellFeedback>> {
  const {
    status,
    puzzleId,
    interactions,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    showSolvedCrownOn,
  } = args;

  const out: Partial<Record<Square, CellFeedback>> = {};

  if (wrongFromSquare !== null) {
    out[wrongFromSquare as Square] = { kind: 'cross', pulse: true };
  }
  if (wrongToSquare !== null) {
    out[wrongToSquare as Square] = { kind: 'cross' };
  }

  const { hintsUsed } = deriveCurrentPlayCounts(interactions, puzzleId);
  if (status === 'solving' && hintsUsed > 0 && expectedFromSquare !== null) {
    out[expectedFromSquare as Square] = {
      kind: 'dot',
      pulse: true,
      corner: 'center',
    };
  }

  if (showSolvedCrownOn !== null) {
    out[showSolvedCrownOn] = { kind: 'crown' };
  }

  return out;
}
