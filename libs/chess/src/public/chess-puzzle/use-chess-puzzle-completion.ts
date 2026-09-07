import { type Accessor, createMemo } from 'solid-js';

import {
  derivePuzzleCompletion,
  type PuzzleCompletion,
} from '../../shared/puzzle-session/completion';
import type { ChessPuzzleInteractionRow } from '../chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';

export type {
  PuzzleCompletion,
  PuzzleCompletionOutcome,
} from '../../shared/puzzle-session/completion';

export function useChessPuzzleCompletion(args: {
  puzzleId: Accessor<string>;
  interactions: Accessor<readonly ChessPuzzleInteractionRow[]>;
  allInteractions: Accessor<readonly ChessPuzzleInteractionRow[]>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
}): Accessor<PuzzleCompletion | null> {
  return createMemo(() => {
    if (args.status() !== CHESS_PUZZLE_PLAY_STATUS.solved) return null;
    return derivePuzzleCompletion({
      interactions: args.interactions(),
      puzzleId: args.puzzleId(),
      allInteractions: args.allInteractions(),
    });
  });
}
