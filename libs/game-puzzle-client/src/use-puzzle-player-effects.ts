import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared/play-attr';
import { type Accessor, createEffect } from 'solid-js';
import { usePuzzleFeedback } from './use-puzzle-feedback';
import { usePuzzleStatusFeedback } from './use-puzzle-status-feedback';

/** Status + correct-move SFX only — no decorative flash / crown timers. */
export function usePuzzlePlayerEffects(args: {
  puzzleId: Accessor<string>;
  solveIdx: Accessor<number>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
}): void {
  const feedback = usePuzzleFeedback();
  const prevSolveIdxRef: { current: number | null } = { current: null };

  createEffect(() => {
    void args.puzzleId();
    prevSolveIdxRef.current = null;
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
      prevSolveIdxRef.current === null ||
      solveIdx <= prevSolveIdxRef.current
    ) {
      prevSolveIdxRef.current = solveIdx;
      return;
    }
    feedback.onCorrectMove();
    prevSolveIdxRef.current = solveIdx;
  });
}
