import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';

import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared-ts/play-attr';
import { type Accessor, createEffect } from 'solid-js';

type PuzzleFeedback = {
  onWrongMove: () => void;
  onSolved: () => void;
};

export function usePuzzleStatusFeedback(args: {
  puzzleId: Accessor<string>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  feedback: PuzzleFeedback;
}): void {
  const prevStatusRef: { current: PuzzlePlayStatus | 'loading' | null } = {
    current: null,
  };

  createEffect(() => {
    void args.puzzleId();
    prevStatusRef.current = null;
  });

  createEffect(() => {
    const prev = prevStatusRef.current;
    const status = args.status();
    prevStatusRef.current = status;
    if (prev !== PUZZLE_PLAY_STATUS.solving) return;
    if (status === PUZZLE_PLAY_STATUS.wrong) {
      args.feedback.onWrongMove();
    }
    if (status === PUZZLE_PLAY_STATUS.solved) {
      args.feedback.onSolved();
    }
  });
}
