import type { ChessPuzzlePlayStatus } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';

import { CHESS_PUZZLE_PLAY_STATUS } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { type Accessor, createEffect } from 'solid-js';

type PuzzleFeedback = {
  onWrongMove: () => void;
  onSolved: () => void;
};

export function usePuzzleStatusFeedback(args: {
  puzzleId: Accessor<string>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  feedback: PuzzleFeedback;
}): void {
  const prevStatusRef: { current: ChessPuzzlePlayStatus | 'loading' | null } = {
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
    if (prev !== CHESS_PUZZLE_PLAY_STATUS.solving) return;
    if (status === CHESS_PUZZLE_PLAY_STATUS.wrong) {
      args.feedback.onWrongMove();
    }
    if (status === CHESS_PUZZLE_PLAY_STATUS.solved) {
      args.feedback.onSolved();
    }
  });
}
