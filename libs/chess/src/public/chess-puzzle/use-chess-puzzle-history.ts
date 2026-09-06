import { useMyId } from '@libs/auth/public/use-current-user';
import { createMemo } from 'solid-js';
import {
  type ChessPuzzleGameLogEntry,
  type ChessPuzzleStats,
  deriveChessPuzzleGameLog,
  deriveChessPuzzleStats,
} from '../chess-puzzle-stats';
import { useChessPuzzleAllInteractions } from './chess-puzzle-play-queries';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

export function useChessPuzzleHistory(): {
  stats: ChessPuzzleStats;
  gameLog: readonly ChessPuzzleGameLogEntry[];
  loading: boolean;
} {
  const myId = useMyId();
  const interactions = useChessPuzzleAllInteractions();
  const profile = useChessPuzzleProfileRatings(myId);

  const stats = createMemo(() =>
    deriveChessPuzzleStats({
      interactions: interactions(),
      profileRating: profile.profileRating,
    })
  );
  const gameLog = createMemo(() => deriveChessPuzzleGameLog(interactions()));

  return {
    get stats() {
      return stats();
    },
    get gameLog() {
      return gameLog();
    },
    get loading() {
      return myId().length === 0;
    },
  };
}
