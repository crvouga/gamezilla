import { useMemo } from 'react';

import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import type { BoardArrow, Square } from '@pkgs/chess-board/chess-board-types';
import type { HintStage } from './use-hint-stage';
import { usePuzzlePlayerCellFeedback } from './use-puzzle-player-cell-feedback';
import { usePuzzlePlayerPresentation } from './use-puzzle-player-presentation';

const EMPTY_ARROWS: readonly BoardArrow[] = Object.freeze([]);

export function usePuzzlePlayerVisual(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  solveIdx: number;
  themes: readonly string[];
  layoutKey: number;
  orientation: 'white' | 'black';
  showCorrectFlash: boolean;
  displayFen: string | null;
  totalTokens: number;
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
  solvedCrownSquare: Square | null;
  hintStage: HintStage;
  rating: number;
}): {
  assistant: ReturnType<typeof usePuzzlePlayerPresentation>['assistant'];
  statusKind: ReturnType<typeof usePuzzlePlayerPresentation>['statusKind'];
  cellFeedback: ReturnType<typeof usePuzzlePlayerCellFeedback>;
  arrows: readonly BoardArrow[];
} {
  const { assistant, statusKind } = usePuzzlePlayerPresentation({
    puzzleId: args.puzzleId,
    status: args.status,
    solveIdx: args.solveIdx,
    themes: args.themes,
    layoutKey: args.layoutKey,
    orientation: args.orientation,
    showCorrectFlash: args.showCorrectFlash,
    displayFen: args.displayFen,
    totalTokens: args.totalTokens,
    wrongFromSquare: args.wrongFromSquare,
    wrongToSquare: args.wrongToSquare,
    rating: args.rating,
  });
  const cellFeedback = usePuzzlePlayerCellFeedback({
    status: args.status,
    wrongFromSquare: args.wrongFromSquare,
    wrongToSquare: args.wrongToSquare,
    expectedFromSquare: args.expectedFromSquare,
    solvedCrownSquare: args.solvedCrownSquare,
  });
  const { hintStage, expectedFromSquare, expectedToSquare } = args;
  const arrows = useMemo<readonly BoardArrow[]>(() => {
    if (
      hintStage !== 'solution' ||
      expectedFromSquare === null ||
      expectedToSquare === null
    ) {
      return EMPTY_ARROWS;
    }
    return [
      {
        from: expectedFromSquare as Square,
        to: expectedToSquare as Square,
        id: 'puzzle-solution',
      },
    ];
  }, [hintStage, expectedFromSquare, expectedToSquare]);
  return { assistant, statusKind, cellFeedback, arrows };
}
