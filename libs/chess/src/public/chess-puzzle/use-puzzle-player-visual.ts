import type { BoardArrow, Square } from '@pkgs/chess-board/chess-board-types';
import { useMemo } from 'react';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';
import type { HintStage } from './use-hint-stage';
import { usePuzzlePlayerCellFeedback } from './use-puzzle-player-cell-feedback';
import { usePuzzlePlayerPresentation } from './use-puzzle-player-presentation';

const EMPTY_ARROWS: readonly BoardArrow[] = Object.freeze([]);

function solutionArrows(args: {
  atFrontier: boolean;
  hintStage: HintStage;
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
}): readonly BoardArrow[] {
  const { atFrontier, hintStage, expectedFromSquare, expectedToSquare } = args;
  if (
    !atFrontier ||
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
}

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
  lastCorrectToSquare: Square | null;
  hintStage: HintStage;
  atFrontier: boolean;
  rating: number;
}): {
  assistant: ReturnType<typeof usePuzzlePlayerPresentation>['assistant'];
  statusKind: ReturnType<typeof usePuzzlePlayerPresentation>['statusKind'];
  cellFeedback: ReturnType<typeof usePuzzlePlayerCellFeedback>['cellFeedback'];
  cellHighlights: ReturnType<
    typeof usePuzzlePlayerCellFeedback
  >['cellHighlights'];
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
  const { cellFeedback, cellHighlights } = usePuzzlePlayerCellFeedback({
    status: args.status,
    wrongFromSquare: args.wrongFromSquare,
    wrongToSquare: args.wrongToSquare,
    expectedFromSquare: args.expectedFromSquare,
    solvedCrownSquare: args.solvedCrownSquare,
    lastCorrectToSquare: args.lastCorrectToSquare,
    displayFen: args.displayFen,
  });
  const arrows = useMemo(
    () =>
      solutionArrows({
        atFrontier: args.atFrontier,
        hintStage: args.hintStage,
        expectedFromSquare: args.expectedFromSquare,
        expectedToSquare: args.expectedToSquare,
      }),
    [
      args.atFrontier,
      args.hintStage,
      args.expectedFromSquare,
      args.expectedToSquare,
    ]
  );
  return { assistant, statusKind, cellFeedback, cellHighlights, arrows };
}
