import type { Square } from '@pkgs/chess-board/chess-board-types';
import { useTimers } from '@pkgs/clock/solid';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';

const CORRECT_FLASH_MS = 1200;

type CorrectMoveFeedback = {
  onCorrectMove: () => void;
};

type Ref<T> = { current: T };

export function usePuzzleCorrectMoveFlash(args: {
  puzzleId: Accessor<string>;
  solveIdx: Accessor<number>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  feedback: CorrectMoveFeedback;
  lastSubmittedToRef: Ref<Square | null>;
  prevSolveIdxRef: Ref<number>;
}): {
  showCorrectFlash: Accessor<boolean>;
  lastCorrectToSquare: Accessor<Square | null>;
} {
  const timers = useTimers();
  const [showCorrectFlash, setShowCorrectFlash] = createSignal(false);
  const [lastCorrectToSquare, setLastCorrectToSquare] =
    createSignal<Square | null>(null);

  createEffect(() => {
    void args.puzzleId();
    setShowCorrectFlash(false);
    setLastCorrectToSquare(null);
  });

  createEffect(() => {
    const solveIdx = args.solveIdx();
    const status = args.status();
    if (
      status !== CHESS_PUZZLE_PLAY_STATUS.solving ||
      solveIdx <= args.prevSolveIdxRef.current ||
      args.prevSolveIdxRef.current <= 0
    ) {
      args.prevSolveIdxRef.current = solveIdx;
      return;
    }
    setShowCorrectFlash(true);
    args.feedback.onCorrectMove();
    if (args.lastSubmittedToRef.current !== null) {
      setLastCorrectToSquare(args.lastSubmittedToRef.current);
    }
    const t = timers.setTimeout(() => {
      setShowCorrectFlash(false);
      setLastCorrectToSquare(null);
    }, CORRECT_FLASH_MS);
    args.prevSolveIdxRef.current = solveIdx;
    onCleanup(() => timers.clearTimeout(t));
  });

  return { showCorrectFlash, lastCorrectToSquare };
}
