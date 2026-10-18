import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';

import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared/play-attr';
import { type Accessor, createEffect } from 'solid-js';
import { useChessPuzzleFeedback } from './use-chess-puzzle-feedback';
import { usePuzzleStatusFeedback } from './use-puzzle-status-feedback';

/** Status + correct-move SFX only — no decorative flash / crown timers. */
export function usePuzzlePlayerEffects(args: {
  puzzleId: Accessor<string>;
  solveIdx: Accessor<number>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
}): void {
  const feedback = useChessPuzzleFeedback();
  const prevSolveIdxRef: { current: number } = { current: 0 };

  createEffect(() => {
    void args.puzzleId();
    prevSolveIdxRef.current = 0;
  });

  usePuzzleStatusFeedback({
    puzzleId: args.puzzleId,
    status: args.status,
    feedback,
  });

  createEffect(() => {
    const solveIdx = args.solveIdx();
    const status = args.status();
    if (
      status !== PUZZLE_PLAY_STATUS.solving ||
      solveIdx <= prevSolveIdxRef.current ||
      prevSolveIdxRef.current <= 0
    ) {
      prevSolveIdxRef.current = solveIdx;
      return;
    }
    feedback.onCorrectMove();
    prevSolveIdxRef.current = solveIdx;
  });
}
