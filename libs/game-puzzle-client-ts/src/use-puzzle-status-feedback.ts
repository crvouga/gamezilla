import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';

import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared-ts/play-attr';
import { type Accessor, createEffect, untrack } from 'solid-js';

type PuzzleFeedback = {
  onWrongMove: () => void;
  onSolved: () => void;
};

export function usePuzzleStatusFeedback(args: {
  puzzleId: Accessor<string>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  feedback: PuzzleFeedback;
}): void {
  // The status last seen on this puzzle; another puzzle starts from none.
  let seen: PuzzlePlayStatus | 'loading' | null = null;

  createEffect(
    () => ({ puzzleId: args.puzzleId(), status: args.status() }),
    (now, before) => {
      if (before?.puzzleId !== now.puzzleId) seen = null;
      if (before?.status === now.status) return;
      const prev = seen;
      seen = now.status;
      if (prev !== PUZZLE_PLAY_STATUS.solving) return;
      if (now.status === PUZZLE_PLAY_STATUS.wrong)
        untrack(() => args.feedback.onWrongMove());
      if (now.status === PUZZLE_PLAY_STATUS.solved)
        untrack(() => args.feedback.onSolved());
    }
  );
}
