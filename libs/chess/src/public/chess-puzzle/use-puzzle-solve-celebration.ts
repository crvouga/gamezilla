import type { Square } from '@pkgs/chess-board/chess-board-types';
import { useTimers } from '@pkgs/clock';
import { useEffect, useState } from 'react';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';

const SOLVED_CELEBRATION_MS = 1500;

export function usePuzzleSolveCelebration(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
  solvedKingSquare: (fen: string) => Square;
}): Square | null {
  const { puzzleId, status, displayFen, solvedKingSquare } = args;
  const timers = useTimers();
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
    const t = timers.setTimeout(
      () => setSolvedCrownSquare(null),
      SOLVED_CELEBRATION_MS
    );
    return () => timers.clearTimeout(t);
  }, [displayFen, solvedKingSquare, status, timers]);

  return solvedCrownSquare;
}
