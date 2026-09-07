import type { Square } from '@pkgs/chess-board/chess-board-types';
import { useTimers } from '@pkgs/clock/solid';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';

const SOLVED_CELEBRATION_MS = 1500;

export function usePuzzleSolveCelebration(args: {
  puzzleId: Accessor<string>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  displayFen: Accessor<string | null>;
  solvedKingSquare: (fen: string) => Square;
}): Accessor<Square | null> {
  const timers = useTimers();
  const [solvedCrownSquare, setSolvedCrownSquare] = createSignal<Square | null>(
    null
  );

  createEffect(() => {
    void args.puzzleId();
    setSolvedCrownSquare(null);
  });

  createEffect(() => {
    if (args.status() !== CHESS_PUZZLE_PLAY_STATUS.solved) return;
    const kingSq = args.solvedKingSquare(args.displayFen() ?? '');
    setSolvedCrownSquare(kingSq);
    const t = timers.setTimeout(
      () => setSolvedCrownSquare(null),
      SOLVED_CELEBRATION_MS
    );
    onCleanup(() => timers.clearTimeout(t));
  });

  return solvedCrownSquare;
}
