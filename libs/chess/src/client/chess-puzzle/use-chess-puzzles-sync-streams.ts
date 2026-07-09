import { useMyId } from '@libs/auth/client/use-current-user';
import {
  useSyncEngine,
  useWatchValue,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, useMemo } from 'react';

import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '../../shared/sync-tables';
import { chessPuzzleSyncRatingBands } from './next-puzzle-id-helpers';

const DEFAULT_RATING = 1200;
const CHESS_PUZZLES_STREAM = 'chess_puzzles';

function useChessPuzzleTargetRating(): number {
  const myId = useMyId();
  const { value: profileRatingRaw } = useWatchValue<number>(
    `SELECT ${ChessPuzzleProfileCol.rating} AS value
     FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     WHERE ${ChessPuzzleProfileCol.id} = ?`,
    [myId]
  );
  return typeof profileRatingRaw === 'number' && profileRatingRaw > 0
    ? profileRatingRaw
    : DEFAULT_RATING;
}

/** Subscribes to PowerSync `chess_puzzles` rating bands for local puzzle picking. */
export function useChessPuzzlesSyncStreams(): void {
  const engine = useSyncEngine();
  const rating = useChessPuzzleTargetRating();
  const bands = useMemo(() => chessPuzzleSyncRatingBands(rating), [rating]);

  useEffect(() => {
    const subscribe = engine.subscribeSyncStream;
    if (subscribe === undefined) return;

    let cancelled = false;
    const active: Array<{ unsubscribe: () => void }> = [];

    void (async () => {
      for (const band of bands) {
        if (cancelled) return;
        const subscription = await subscribe(CHESS_PUZZLES_STREAM, {
          rating_band: band,
        });
        if (cancelled) {
          subscription.unsubscribe();
          return;
        }
        active.push(subscription);
      }
    })();

    return () => {
      cancelled = true;
      for (const subscription of active) {
        subscription.unsubscribe();
      }
    };
  }, [bands, engine, rating]);
}
