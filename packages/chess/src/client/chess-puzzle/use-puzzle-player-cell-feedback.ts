import { useMemo } from 'react';

import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import type { Square } from '../chess-board/chess-board-types';
import { deriveChessPuzzleCellFeedback } from './chess-puzzle-cell-feedback';

export function usePuzzlePlayerCellFeedback(args: {
  status: ChessPuzzlePlayStatus | 'loading';
  puzzleId: string;
  interactions: ChessPuzzleInteractionRow[];
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  solvedCrownSquare: Square | null;
}) {
  const {
    status,
    puzzleId,
    interactions,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    solvedCrownSquare,
  } = args;

  return useMemo(
    () =>
      deriveChessPuzzleCellFeedback({
        status,
        puzzleId,
        interactions,
        wrongFromSquare,
        wrongToSquare,
        expectedFromSquare,
        showSolvedCrownOn: solvedCrownSquare,
      }),
    [
      status,
      puzzleId,
      interactions,
      wrongFromSquare,
      wrongToSquare,
      expectedFromSquare,
      solvedCrownSquare,
    ]
  );
}
