import { useMemo } from 'react';

import { deriveCurrentStreak, sliceCurrentPlay } from '../chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionKind,
  type ChessPuzzleInteractionRow,
} from '../chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';

export type PuzzleCompletionOutcome = 'solved' | 'abandoned';

export type PuzzleCompletion = {
  readonly outcome: PuzzleCompletionOutcome;
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  readonly streak: number;
  readonly puzzleRating: number;
};

function isTerminalKind(kind: ChessPuzzleInteractionKind): boolean {
  return (
    kind === CHESS_PUZZLE_INTERACTION_KIND.solved ||
    kind === CHESS_PUZZLE_INTERACTION_KIND.abandoned
  );
}

function terminalFromPlay(
  play: readonly ChessPuzzleInteractionRow[]
): ChessPuzzleInteractionRow | null {
  for (let i = play.length - 1; i >= 0; i -= 1) {
    const row = play[i];
    if (row !== undefined && isTerminalKind(row.kind)) return row;
  }
  return null;
}

export function derivePuzzleCompletion(args: {
  interactions: readonly ChessPuzzleInteractionRow[];
  puzzleId: string;
  allInteractions: readonly ChessPuzzleInteractionRow[];
}): PuzzleCompletion | null {
  const play = sliceCurrentPlay(args.interactions, args.puzzleId);
  const terminal = terminalFromPlay(play);
  if (terminal === null) return null;
  if (terminal.ratingBefore <= 0 || terminal.ratingAfter <= 0) return null;

  return {
    outcome:
      terminal.kind === CHESS_PUZZLE_INTERACTION_KIND.solved
        ? 'solved'
        : 'abandoned',
    ratingBefore: terminal.ratingBefore,
    ratingAfter: terminal.ratingAfter,
    delta: terminal.ratingAfter - terminal.ratingBefore,
    streak: deriveCurrentStreak(args.allInteractions),
    puzzleRating: terminal.puzzleRating,
  };
}

export function useChessPuzzleCompletion(args: {
  puzzleId: string;
  interactions: readonly ChessPuzzleInteractionRow[];
  allInteractions: readonly ChessPuzzleInteractionRow[];
  status: ChessPuzzlePlayStatus | 'loading';
}): PuzzleCompletion | null {
  const { puzzleId, interactions, allInteractions, status } = args;
  return useMemo(() => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) return null;
    return derivePuzzleCompletion({ interactions, puzzleId, allInteractions });
  }, [allInteractions, interactions, puzzleId, status]);
}
