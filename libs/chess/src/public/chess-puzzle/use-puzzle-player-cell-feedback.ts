import type { Square } from '@pkgs/chess-board/chess-board-types';
import { useTheme } from '@pkgs/ui';
import { type Accessor, createMemo } from 'solid-js';

import { deriveChessPuzzleCellFeedback } from '../../shared/puzzle-session/cell-feedback';
import { deriveChessPuzzleCellHighlights } from '../../shared/puzzle-session/cell-highlights';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';

export function usePuzzlePlayerCellFeedback(args: {
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  wrongFromSquare: Accessor<string | null>;
  wrongToSquare: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
  solvedCrownSquare: Accessor<Square | null>;
  lastCorrectToSquare: Accessor<Square | null>;
  displayFen: Accessor<string | null>;
}): {
  cellFeedback: Accessor<ReturnType<typeof deriveChessPuzzleCellFeedback>>;
  cellHighlights: Accessor<ReturnType<typeof deriveChessPuzzleCellHighlights>>;
} {
  const theme = useTheme();

  const cellFeedback = createMemo(() =>
    deriveChessPuzzleCellFeedback({
      status: args.status(),
      wrongFromSquare: args.wrongFromSquare(),
      wrongToSquare: args.wrongToSquare(),
      expectedFromSquare: args.expectedFromSquare(),
      showSolvedCrownOn: args.solvedCrownSquare(),
      lastCorrectToSquare: args.lastCorrectToSquare(),
    })
  );

  const cellHighlights = createMemo(() =>
    deriveChessPuzzleCellHighlights({
      status: args.status(),
      lastCorrectToSquare: args.lastCorrectToSquare(),
      solvedKingSquare:
        args.status() === 'solved' && args.displayFen() !== null
          ? args.solvedCrownSquare()
          : null,
      successColor: theme.palette().success,
    })
  );

  return { cellFeedback, cellHighlights };
}
