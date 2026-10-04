import { useMyId } from '@libs/auth-client/use-current-user';
import type {
  ChessPuzzleGameLogEntry,
  ChessPuzzleStats,
} from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import {
  deriveChessPuzzleGameLog,
  deriveChessPuzzleStats,
} from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import { type Accessor, createMemo } from 'solid-js';
import { useChessPuzzleAllInteractions } from './chess-puzzle-play-queries';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { useChessPuzzleRatingEvents } from './use-chess-puzzle-rating-events';

export function useChessPuzzleHistory(): {
  stats: Accessor<ChessPuzzleStats>;
  gameLog: Accessor<readonly ChessPuzzleGameLogEntry[]>;
  loading: Accessor<boolean>;
} {
  const myId = useMyId();
  const interactions = useChessPuzzleAllInteractions();
  const ratingEvents = useChessPuzzleRatingEvents();
  const { profileRating, profileRd } = useChessPuzzleProfileRatings(myId);

  const stats = createMemo(() =>
    deriveChessPuzzleStats({
      profileRating: profileRating(),
      profileRatingDeviation: profileRd(),
      ratingEvents: ratingEvents(),
      interactions: interactions(),
    })
  );
  const gameLog = createMemo(() => deriveChessPuzzleGameLog(ratingEvents()));

  return {
    stats,
    gameLog,
    loading: createMemo(() => myId().length === 0),
  };
}
