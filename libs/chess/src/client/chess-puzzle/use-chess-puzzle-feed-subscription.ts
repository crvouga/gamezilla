import { useMyId } from '@libs/auth/client/use-current-user';
import { useWatchValue } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEngineSubscriptions } from '@pkgs/sync-engine/client/use-sync-engine-subscriptions';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '@libs/db/shared/chess-tables';
import {
  chessPuzzleSyncRatingBands,
  resolveEffectivePuzzleRating,
} from '../../shared/chess-puzzle-feed-config';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';

const CHESS_PUZZLES_STREAM = 'chess_puzzles';

function usePuzzleProfileRating(): number {
  const myId = useMyId();
  const { value: profileRatingRaw } = useWatchValue<number>(
    `SELECT ${ChessPuzzleProfileCol.rating} AS value
     FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     WHERE ${ChessPuzzleProfileCol.id} = ?`,
    [myId]
  );
  if (typeof profileRatingRaw === 'number' && profileRatingRaw > 0) {
    return profileRatingRaw;
  }
  return 0;
}

/**
 * Subscribes to parameterized `chess_puzzles` streams for the effective
 * feed rating's band window. Mount under ChessMainMenu so the feed starts
 * before puzzle play.
 */
export function useChessPuzzleFeedSubscription(): void {
  const [config] = useChessPuzzleFeedConfig();
  const profileRating = usePuzzleProfileRating();
  const effectiveRating = useMemo(
    () => resolveEffectivePuzzleRating({ config, profileRating }),
    [config, profileRating]
  );
  const bands = useMemo(
    () => chessPuzzleSyncRatingBands(effectiveRating),
    [effectiveRating]
  );
  const syncEngineSubscriptions = useMemo(
    () =>
      bands.map((band) => ({ stream: CHESS_PUZZLES_STREAM, params: { band } })),
    [bands]
  );
  useSyncEngineSubscriptions(syncEngineSubscriptions);
}
