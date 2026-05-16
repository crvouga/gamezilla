import type { CellFeedback, Square } from '../chess-board/chess-board-types';
import type { SolveStatus } from './use-chess-puzzle-solver';

export function deriveChessPuzzleCellFeedback(args: {
  status: SolveStatus;
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  showSolvedCrownOn: Square | null;
}): Partial<Record<Square, CellFeedback>> {
  const {
    status,
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

  // Hint reveal: pulse a dot on the from-square once the server has
  // returned an expected move. The local hint stage in `useHintStage`
  // controls whether the corresponding solution arrow is also drawn
  // (see `usePuzzlePlayerVisual`).
  if (status === 'solving' && expectedFromSquare !== null) {
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
