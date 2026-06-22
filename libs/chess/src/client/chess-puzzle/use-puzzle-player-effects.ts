import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import { useEffect, useRef, useState } from 'react';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import { solvedPuzzleKingSquare } from './chess-puzzle-solved-king-square';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';

const CORRECT_FLASH_MS = 1500;
const ELO_TICK_DELAY_MS = 400;

export function usePuzzlePlayerEffects(args: {
  puzzleId: string;
  solveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
}): { showCorrectFlash: boolean; solvedCrownSquare: Square | null } {
  const { puzzleId, solveIdx, status, displayFen } = args;
  const feedback = useChessPuzzleFeedback();
  const prevStatusRef = useRef<ChessPuzzlePlayStatus | 'loading' | null>(null);
  const prevSolveIdxRef = useRef(solveIdx);
  const [showCorrectFlash, setShowCorrectFlash] = useState(false);
  const [solvedCrownSquare, setSolvedCrownSquare] = useState<Square | null>(
    null
  );

  // The screen no longer remounts the player on puzzle change, so we have
  // to explicitly reset the cross-puzzle bookkeeping: a stale crown from
  // the previous solved puzzle would otherwise paint on the new board for
  // up to `CORRECT_FLASH_MS`, and a stale `prevSolveIdx` could suppress
  // the first correct-move flash on the new attempt.
  useEffect(() => {
    prevSolveIdxRef.current = 0;
    prevStatusRef.current = null;
    setShowCorrectFlash(false);
    setSolvedCrownSquare(null);
  }, [puzzleId]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === status) return;
    if (status === CHESS_PUZZLE_PLAY_STATUS.wrong) {
      feedback.onWrongMove();
    }
    if (status === CHESS_PUZZLE_PLAY_STATUS.solved) {
      feedback.onSolved();
      const t = setTimeout(() => feedback.onEloTick(), ELO_TICK_DELAY_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [feedback, status]);

  useEffect(() => {
    if (
      status === CHESS_PUZZLE_PLAY_STATUS.solving &&
      solveIdx > prevSolveIdxRef.current &&
      prevSolveIdxRef.current > 0
    ) {
      setShowCorrectFlash(true);
      const t = setTimeout(() => setShowCorrectFlash(false), CORRECT_FLASH_MS);
      prevSolveIdxRef.current = solveIdx;
      return () => clearTimeout(t);
    }
    prevSolveIdxRef.current = solveIdx;
    return undefined;
  }, [solveIdx, status]);

  useEffect(() => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) return;
    const kingSq = solvedPuzzleKingSquare(displayFen ?? '');
    setSolvedCrownSquare(kingSq);
    const t = setTimeout(() => setSolvedCrownSquare(null), CORRECT_FLASH_MS);
    return () => clearTimeout(t);
  }, [displayFen, status]);

  return { showCorrectFlash, solvedCrownSquare };
}
