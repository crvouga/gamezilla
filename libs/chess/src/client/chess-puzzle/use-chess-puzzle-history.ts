import { useMyId } from '@libs/auth/client/use-current-user';
import { useMemo } from 'react';
import {
  type ChessPuzzleGameLogEntry,
  type ChessPuzzleStats,
  deriveChessPuzzleGameLog,
  deriveChessPuzzleStats,
} from '../../shared/chess-puzzle-stats';
import { useChessPuzzleAllInteractions } from './chess-puzzle-play-queries';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

export function useChessPuzzleHistory(): {
  stats: ChessPuzzleStats;
  gameLog: readonly ChessPuzzleGameLogEntry[];
  loading: boolean;
} {
  const myId = useMyId();
  const interactions = useChessPuzzleAllInteractions();
  const { profileRating } = useChessPuzzleProfileRatings(myId);

  const stats = useMemo(
    () => deriveChessPuzzleStats({ interactions, profileRating }),
    [interactions, profileRating]
  );
  const gameLog = useMemo(
    () => deriveChessPuzzleGameLog(interactions),
    [interactions]
  );

  return {
    stats,
    gameLog,
    loading: myId.length === 0,
  };
}
