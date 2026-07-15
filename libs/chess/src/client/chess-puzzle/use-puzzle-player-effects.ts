import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import { solvedPuzzleKingSquare } from './chess-puzzle-solved-king-square';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';
import { usePuzzleCorrectMoveFlash } from './use-puzzle-correct-move-flash';
import { usePuzzleSolveCelebration } from './use-puzzle-solve-celebration';
import { usePuzzleStatusFeedback } from './use-puzzle-status-feedback';

export function usePuzzlePlayerEffects(args: {
  puzzleId: string;
  solveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
  lastSubmittedToRef: MutableRefObject<Square | null>;
}): {
  showCorrectFlash: boolean;
  solvedCrownSquare: Square | null;
  lastCorrectToSquare: Square | null;
} {
  const { puzzleId, solveIdx, status, displayFen, lastSubmittedToRef } = args;
  const feedback = useChessPuzzleFeedback();
  const prevSolveIdxRef = useRef(solveIdx);

  useEffect(() => {
    prevSolveIdxRef.current = 0;
    lastSubmittedToRef.current = null;
  }, [lastSubmittedToRef, puzzleId]);

  usePuzzleStatusFeedback({
    puzzleId,
    status,
    feedback,
  });
  const { showCorrectFlash, lastCorrectToSquare } = usePuzzleCorrectMoveFlash({
    puzzleId,
    solveIdx,
    status,
    feedback,
    lastSubmittedToRef,
    prevSolveIdxRef,
  });
  const solvedCrownSquare = usePuzzleSolveCelebration({
    puzzleId,
    status,
    displayFen,
    solvedKingSquare: solvedPuzzleKingSquare,
  });

  return {
    showCorrectFlash,
    solvedCrownSquare,
    lastCorrectToSquare,
  };
}
