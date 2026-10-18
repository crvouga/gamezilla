import { useMyId } from '@libs/auth-client/use-current-user';
import type {
  PuzzleGameLogEntry,
  PuzzleStats,
} from '@libs/game-puzzle-shared/stats';
import {
  derivePuzzleGameLog,
  derivePuzzleStats,
} from '@libs/game-puzzle-shared/stats';
import { type Accessor, createMemo } from 'solid-js';
import { useChessPuzzleAllInteractions } from './chess-puzzle-play-queries';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useChessPuzzleRatingEvents } from './use-chess-puzzle-rating-events';

export function useChessPuzzleHistory(): {
  stats: Accessor<PuzzleStats>;
  gameLog: Accessor<readonly PuzzleGameLogEntry[]>;
  loading: Accessor<boolean>;
} {
  const myId = useMyId();
  const interactions = useChessPuzzleAllInteractions();
  const ratingEvents = useChessPuzzleRatingEvents();
  const { profileRating, profileRd } = useChessPuzzleProfileRatings(myId);

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
