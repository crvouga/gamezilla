import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import type { CellFeedback, Square } from '@pkgs/chess-board-core-shared/types';

export function deriveChessPuzzleCellFeedback(args: {
  status: SolveStatus;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
}): Partial<Record<Square, CellFeedback>> {
  const { status, wrongToSquare, expectedFromSquare } = args;

  const out: Partial<Record<Square, CellFeedback>> = {};

  // Only the square the wrong move ended on: the piece is standing there.
  if (wrongToSquare !== null) {
    out[wrongToSquare as Square] = { kind: 'cross' };
  }

  if (status === 'solving' && expectedFromSquare !== null) {
    out[expectedFromSquare as Square] = {
      kind: 'dot',
      corner: 'center',
    };
  }

  return out;
}
