import { useMyId } from '@libs/auth/public/use-current-user';
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
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useChessPuzzleRatingEvents } from './use-chess-puzzle-rating-events';

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
  const myId = useMyId();
  const ratingEvents = useChessPuzzleRatingEvents();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  return createMemo(() => {
    const status = args.status();
    if (
      status !== CHESS_PUZZLE_PLAY_STATUS.solved &&
      status !== CHESS_PUZZLE_PLAY_STATUS.revealed
    ) {
      return null;
    }
    return derivePuzzleCompletion({
      interactions: args.interactions(),
      puzzleId: args.puzzleId(),
      allInteractions: args.allInteractions(),
      ratingEvents: ratingEvents(),
      profileRating: profileRating(),
    });
  });
}
