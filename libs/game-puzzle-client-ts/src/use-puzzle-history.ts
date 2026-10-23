import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type {
  PuzzleGameLogEntry,
  PuzzleStats,
} from '@libs/game-puzzle-shared-ts/stats';
import {
  derivePuzzleGameLog,
  derivePuzzleStats,
} from '@libs/game-puzzle-shared-ts/stats';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleAllInteractions } from './puzzle-play-queries';
import { usePuzzleProfileRatings } from './use-puzzle-profile-ratings';
import { usePuzzleRatingEvents } from './use-puzzle-rating-events';

export function usePuzzleHistory(): {
  stats: Accessor<PuzzleStats>;
  gameLog: Accessor<readonly PuzzleGameLogEntry[]>;
  loading: Accessor<boolean>;
} {
  const myId = useMyId();
  const interactions = usePuzzleAllInteractions();
  const ratingEvents = usePuzzleRatingEvents();
  const { profileRating, profileRd } = usePuzzleProfileRatings(myId);

  const stats = createMemo(() =>
    derivePuzzleStats({
      profileRating: profileRating(),
      profileRatingDeviation: profileRd(),
      ratingEvents: ratingEvents(),
      interactions: interactions(),
    })
  );
  const gameLog = createMemo(() =>
    derivePuzzleGameLog(ratingEvents(), interactions())
  );

  return {
    stats,
    gameLog,
    loading: createMemo(() => myId().length === 0),
  };
}
