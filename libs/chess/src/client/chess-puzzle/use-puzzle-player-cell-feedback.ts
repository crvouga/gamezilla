import { useMemo } from 'react';

import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import type { Square } from '../chess-board/chess-board-types';
import { deriveChessPuzzleCellFeedback } from './chess-puzzle-cell-feedback';

export function usePuzzlePlayerCellFeedback(args: {
  status: ChessPuzzlePlayStatus | 'loading';
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  solvedCrownSquare: Square | null;
}) {
  const {
    status,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    solvedCrownSquare,
  } = args;

  return useMemo(
    () =>
      deriveChessPuzzleCellFeedback({
        status,
        wrongFromSquare,
        wrongToSquare,
        expectedFromSquare,
        showSolvedCrownOn: solvedCrownSquare,
      }),
    [
      status,
      wrongFromSquare,
      wrongToSquare,
      expectedFromSquare,
      solvedCrownSquare,
    ]
  );
}
