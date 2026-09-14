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

export function useChessPuzzleHistory(): {
  stats: Accessor<ChessPuzzleStats>;
  gameLog: Accessor<readonly ChessPuzzleGameLogEntry[]>;
  loading: Accessor<boolean>;
} {
  const myId = useMyId();
  const interactions = useChessPuzzleAllInteractions();
  const profile = useChessPuzzleProfileRatings(myId);

  const stats = createMemo(() =>
    deriveChessPuzzleStats({
      interactions: interactions(),
      profileRating: profile.profileRating(),
    })
  );
  const gameLog = createMemo(() => deriveChessPuzzleGameLog(interactions()));

  return {
    stats,
    gameLog,
    loading: createMemo(() => myId().length === 0),
  };
}
