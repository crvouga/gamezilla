import type { BoardArrow } from '@pkgs/chess-board/chess-board-types';
import { type Accessor, createMemo } from 'solid-js';

import type { HintStage } from '../../shared/puzzle-session/hint-stage';
import { solutionArrows } from '../../shared/puzzle-session/solve-projection';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';
import { usePuzzlePlayerCellFeedback } from './use-puzzle-player-cell-feedback';
import { usePuzzlePlayerPresentation } from './use-puzzle-player-presentation';

export function usePuzzlePlayerVisual(args: {
  puzzleId: Accessor<string>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  solveIdx: Accessor<number>;
  layoutKey: Accessor<number>;
  displayFen: Accessor<string | null>;
  wrongUci: Accessor<string | null>;
  wrongFromSquare: Accessor<string | null>;
  wrongToSquare: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
  expectedToSquare: Accessor<string | null>;
  hintStage: Accessor<HintStage>;
  opponentReplying: Accessor<boolean>;
  viewingHistory: Accessor<boolean>;
  atFrontier: Accessor<boolean>;
}): {
  assistant: ReturnType<typeof usePuzzlePlayerPresentation>['assistant'];
  statusKind: ReturnType<typeof usePuzzlePlayerPresentation>['statusKind'];
  cellFeedback: ReturnType<typeof usePuzzlePlayerCellFeedback>['cellFeedback'];
  cellHighlights: ReturnType<
    typeof usePuzzlePlayerCellFeedback
  >['cellHighlights'];
  arrows: Accessor<readonly BoardArrow[]>;
} {
  const { assistant, statusKind } = usePuzzlePlayerPresentation({
    puzzleId: args.puzzleId,
    status: args.status,
    solveIdx: args.solveIdx,
    layoutKey: args.layoutKey,
    displayFen: args.displayFen,
    wrongUci: args.wrongUci,
    hintStage: args.hintStage,
    opponentReplying: args.opponentReplying,
    viewingHistory: args.viewingHistory,
  });
  const { cellFeedback, cellHighlights } = usePuzzlePlayerCellFeedback({
    status: args.status,
    wrongFromSquare: args.wrongFromSquare,
    wrongToSquare: args.wrongToSquare,
    expectedFromSquare: args.expectedFromSquare,
  });
  const arrows = createMemo(() =>
    solutionArrows({
      atFrontier: args.atFrontier(),
      hintStage: args.hintStage(),
      expectedFromSquare: args.expectedFromSquare(),
      expectedToSquare: args.expectedToSquare(),
    })
  );
  return { assistant, statusKind, cellFeedback, cellHighlights, arrows };
}
