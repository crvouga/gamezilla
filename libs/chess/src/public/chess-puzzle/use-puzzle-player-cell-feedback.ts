import type { Square } from '@pkgs/chess-board/chess-board-types';
import { useTheme } from '@pkgs/ui';
import { useMemo } from 'react';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';
import { deriveChessPuzzleCellFeedback } from './chess-puzzle-cell-feedback';
import { deriveChessPuzzleCellHighlights } from './chess-puzzle-cell-highlights';

export function usePuzzlePlayerCellFeedback(args: {
  status: ChessPuzzlePlayStatus | 'loading';
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  solvedCrownSquare: Square | null;
  lastCorrectToSquare: Square | null;
  displayFen: string | null;
}) {
  const theme = useTheme();
  const {
    status,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    solvedCrownSquare,
    lastCorrectToSquare,
    displayFen,
  } = args;

  const cellFeedback = useMemo(
    () =>
      deriveChessPuzzleCellFeedback({
        status,
        wrongFromSquare,
        wrongToSquare,
        expectedFromSquare,
        showSolvedCrownOn: solvedCrownSquare,
        lastCorrectToSquare,
      }),
    [
      status,
      wrongFromSquare,
      wrongToSquare,
      expectedFromSquare,
      solvedCrownSquare,
      lastCorrectToSquare,
    ]
  );

  const cellHighlights = useMemo(
    () =>
      deriveChessPuzzleCellHighlights({
        status,
        lastCorrectToSquare,
        solvedKingSquare:
          status === 'solved' && displayFen !== null ? solvedCrownSquare : null,
        successColor: theme.colors.success,
      }),
    [
      displayFen,
      lastCorrectToSquare,
      solvedCrownSquare,
      status,
      theme.colors.success,
    ]
  );

  return { cellFeedback, cellHighlights };
}
