import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import { useEffect, useState } from 'react';
import type { Square } from '@pkgs/chess-board/chess-board-types';

const SOLVED_CELEBRATION_MS = 1500;

export function usePuzzleSolveCelebration(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
  solvedKingSquare: (fen: string) => Square;
}): Square | null {
  const { puzzleId, status, displayFen, solvedKingSquare } = args;
  const [solvedCrownSquare, setSolvedCrownSquare] = useState<Square | null>(
    null
  );

  useEffect(() => {
    setSolvedCrownSquare(null);
  }, [puzzleId]);

  useEffect(() => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) return;
    const kingSq = solvedKingSquare(displayFen ?? '');
    setSolvedCrownSquare(kingSq);
    const t = setTimeout(() => setSolvedCrownSquare(null), SOLVED_CELEBRATION_MS);
    return () => clearTimeout(t);
  }, [displayFen, solvedKingSquare, status]);

  return solvedCrownSquare;
}
