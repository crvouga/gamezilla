import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared-ts/play-attr';
import { type Accessor, createEffect, untrack } from 'solid-js';
import { usePuzzleFeedback } from './use-puzzle-feedback';
import { usePuzzleStatusFeedback } from './use-puzzle-status-feedback';

/** Status + correct-move SFX only — no decorative flash / crown timers. */
export function usePuzzlePlayerEffects(args: {
  puzzleId: Accessor<string>;
  solveIdx: Accessor<number>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
}): void {
  const feedback = usePuzzleFeedback();
  // The step last seen on this puzzle; another puzzle starts from none.
  let seenSolveIdx: number | null = null;

  usePuzzleStatusFeedback({
    puzzleId: args.puzzleId,
    status: args.status,
    feedback,
  });

  createEffect(
    () => ({
      puzzleId: args.puzzleId(),
      solveIdx: args.solveIdx(),
      status: args.status(),
    }),
    (now, before) => {
      if (before?.puzzleId !== now.puzzleId) seenSolveIdx = null;
      if (before?.solveIdx === now.solveIdx && before.status === now.status)
        return;
      const advanced =
        now.status === PUZZLE_PLAY_STATUS.solving &&
        seenSolveIdx !== null &&
        now.solveIdx > seenSolveIdx;
      seenSolveIdx = now.solveIdx;
      if (advanced) untrack(() => feedback.onCorrectMove());
    }
  );
}
