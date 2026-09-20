import { useMyId } from '@libs/auth/public/use-current-user';
import { type Accessor, createMemo } from 'solid-js';
import {
  type ChessPuzzleGameLogEntry,
  type ChessPuzzleStats,
  deriveChessPuzzleGameLog,
  deriveChessPuzzleStats,
} from '../chess-puzzle-stats';
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
