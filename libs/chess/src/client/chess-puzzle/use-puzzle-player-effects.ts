import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import { useEffect, useRef, useState } from 'react';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import { solvedPuzzleKingSquare } from './chess-puzzle-solved-king-square';

const CORRECT_FLASH_MS = 1500;

export function usePuzzlePlayerEffects(args: {
  solveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
}): { showCorrectFlash: boolean; solvedCrownSquare: Square | null } {
  const { solveIdx, status, displayFen } = args;
  const prevSolveIdxRef = useRef(solveIdx);
  const [showCorrectFlash, setShowCorrectFlash] = useState(false);
  const [solvedCrownSquare, setSolvedCrownSquare] = useState<Square | null>(
    null
  );

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
