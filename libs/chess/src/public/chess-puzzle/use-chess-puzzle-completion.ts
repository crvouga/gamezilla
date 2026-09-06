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
  puzzleId: string;
  interactions: readonly ChessPuzzleInteractionRow[];
  allInteractions: readonly ChessPuzzleInteractionRow[];
  status: ChessPuzzlePlayStatus | 'loading';
}): Accessor<PuzzleCompletion | null> {
  return createMemo(() => {
    const { puzzleId, interactions, allInteractions, status } = args;
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) return null;
    return derivePuzzleCompletion({ interactions, puzzleId, allInteractions });
  });
}
