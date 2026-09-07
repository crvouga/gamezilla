import type { Square } from '@pkgs/chess-board/chess-board-types';
import { type Accessor, createEffect } from 'solid-js';

import { solvedPuzzleKingSquare } from '../../shared/puzzle-session/solved-king-square';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';
import { usePuzzleCorrectMoveFlash } from './use-puzzle-correct-move-flash';
import { usePuzzleSolveCelebration } from './use-puzzle-solve-celebration';
import { usePuzzleStatusFeedback } from './use-puzzle-status-feedback';

export function usePuzzlePlayerEffects(args: {
  puzzleId: Accessor<string>;
  solveIdx: Accessor<number>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  displayFen: Accessor<string | null>;
  lastSubmittedToRef: { current: Square | null };
}): {
  showCorrectFlash: Accessor<boolean>;
  solvedCrownSquare: Accessor<Square | null>;
  lastCorrectToSquare: Accessor<Square | null>;
} {
  const feedback = useChessPuzzleFeedback();
  const prevSolveIdxRef: { current: number } = { current: 0 };

  createEffect(() => {
    void args.puzzleId();
    prevSolveIdxRef.current = 0;
    args.lastSubmittedToRef.current = null;
  });

  usePuzzleStatusFeedback({
    puzzleId: args.puzzleId,
    status: args.status,
    feedback,
  });
  const { showCorrectFlash, lastCorrectToSquare } = usePuzzleCorrectMoveFlash({
    puzzleId: args.puzzleId,
    solveIdx: args.solveIdx,
    status: args.status,
    feedback,
    lastSubmittedToRef: args.lastSubmittedToRef,
    prevSolveIdxRef,
  });
  const solvedCrownSquare = usePuzzleSolveCelebration({
    puzzleId: args.puzzleId,
    status: args.status,
    displayFen: args.displayFen,
    solvedKingSquare: solvedPuzzleKingSquare,
  });

  return { showCorrectFlash, solvedCrownSquare, lastCorrectToSquare };
}
