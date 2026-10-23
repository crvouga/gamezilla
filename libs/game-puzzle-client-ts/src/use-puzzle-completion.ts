import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { derivePuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import type { PuzzleInteractionRow } from '@libs/game-puzzle-shared-ts/interaction-entities';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared-ts/play-attr';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingEvents } from './use-puzzle-rating-events';

export function usePuzzleCompletion(args: {
  puzzleId: Accessor<string>;
  interactions: Accessor<readonly PuzzleInteractionRow[]>;
  allInteractions: Accessor<readonly PuzzleInteractionRow[]>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
}): Accessor<PuzzleCompletion | null> {
  const myId = useMyId();
  const ratingEvents = usePuzzleRatingEvents();
  const { profileRating } = usePuzzleProfileRatings(myId);
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
