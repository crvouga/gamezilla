import { useMyId } from '@libs/auth-client/use-current-user';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import { derivePuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import type { PuzzleInteractionRow } from '@libs/game-puzzle-shared/interaction-entities';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared/play-attr';
import { type Accessor, createMemo } from 'solid-js';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useChessPuzzleRatingEvents } from './use-chess-puzzle-rating-events';

export function useChessPuzzleCompletion(args: {
  puzzleId: Accessor<string>;
  interactions: Accessor<readonly PuzzleInteractionRow[]>;
  allInteractions: Accessor<readonly PuzzleInteractionRow[]>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
}): Accessor<PuzzleCompletion | null> {
  const myId = useMyId();
  const ratingEvents = useChessPuzzleRatingEvents();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  return createMemo(() => {
    const status = args.status();
    if (
      status !== PUZZLE_PLAY_STATUS.solved &&
      status !== PUZZLE_PLAY_STATUS.revealed
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
