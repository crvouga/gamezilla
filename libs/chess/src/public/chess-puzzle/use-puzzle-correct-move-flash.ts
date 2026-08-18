import type { Square } from '@pkgs/chess-board/chess-board-types';
import { useTimers } from '@pkgs/clock';
import { type MutableRefObject, useEffect, useState } from 'react';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';

const CORRECT_FLASH_MS = 1200;

type CorrectMoveFeedback = {
  onCorrectMove: () => void;
};

export function usePuzzleCorrectMoveFlash(args: {
  puzzleId: string;
  solveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  feedback: CorrectMoveFeedback;
  lastSubmittedToRef: MutableRefObject<Square | null>;
  prevSolveIdxRef: MutableRefObject<number>;
}): { showCorrectFlash: boolean; lastCorrectToSquare: Square | null } {
  const {
    puzzleId,
    solveIdx,
    status,
    feedback,
    lastSubmittedToRef,
    prevSolveIdxRef,
  } = args;
  const timers = useTimers();
  const [showCorrectFlash, setShowCorrectFlash] = useState(false);
  const [lastCorrectToSquare, setLastCorrectToSquare] = useState<Square | null>(
    null
  );

  useEffect(() => {
    setShowCorrectFlash(false);
    setLastCorrectToSquare(null);
  }, [puzzleId]);

  useEffect(() => {
    if (
      status !== CHESS_PUZZLE_PLAY_STATUS.solving ||
      solveIdx <= prevSolveIdxRef.current ||
      prevSolveIdxRef.current <= 0
    ) {
      prevSolveIdxRef.current = solveIdx;
      return;
    }
    setShowCorrectFlash(true);
    feedback.onCorrectMove();
    if (lastSubmittedToRef.current !== null) {
      setLastCorrectToSquare(lastSubmittedToRef.current);
    }
    const t = timers.setTimeout(() => {
      setShowCorrectFlash(false);
      setLastCorrectToSquare(null);
    }, CORRECT_FLASH_MS);
    prevSolveIdxRef.current = solveIdx;
    return () => timers.clearTimeout(t);
  }, [feedback, lastSubmittedToRef, prevSolveIdxRef, solveIdx, status, timers]);

  return { showCorrectFlash, lastCorrectToSquare };
}
