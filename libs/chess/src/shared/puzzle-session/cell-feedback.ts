import type { CellFeedback, Square } from '@pkgs/chess-board-core/types';
import type { SolveStatus } from './solve-status';

export function deriveChessPuzzleCellFeedback(args: {
  status: SolveStatus;
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  showSolvedCrownOn: Square | null;
  lastCorrectToSquare: Square | null;
}): Partial<Record<Square, CellFeedback>> {
  const {
    status,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    showSolvedCrownOn,
    lastCorrectToSquare,
  } = args;

  const out: Partial<Record<Square, CellFeedback>> = {};

  if (wrongFromSquare !== null) {
    out[wrongFromSquare as Square] = { kind: 'cross' };
  }
  if (wrongToSquare !== null) {
    out[wrongToSquare as Square] = { kind: 'cross' };
  }

  if (status === 'solving' && expectedFromSquare !== null) {
    out[expectedFromSquare as Square] = {
      kind: 'dot',
      corner: 'center',
    };
  }

  if (lastCorrectToSquare !== null) {
    out[lastCorrectToSquare] = { kind: 'star' };
  }

  if (showSolvedCrownOn !== null) {
    out[showSolvedCrownOn] = { kind: 'crown' };
  }

  return out;
}
