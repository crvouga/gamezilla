import { useMyId } from '@libs/auth-client/use-current-user';
import type { ChessPuzzleInteractionRow } from '@libs/chess-puzzle-shared/chess-puzzle-interaction-entities';
import type { ChessPuzzlePlayStatus } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { CHESS_PUZZLE_PLAY_STATUS } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import type { PuzzleCompletion } from '@libs/chess-puzzle-shared/completion';
import { derivePuzzleCompletion } from '@libs/chess-puzzle-shared/completion';
import { type Accessor, createMemo } from 'solid-js';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useChessPuzzleRatingEvents } from './use-chess-puzzle-rating-events';

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
