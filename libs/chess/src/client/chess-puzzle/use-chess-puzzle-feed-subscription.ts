import {
  useSyncEngine,
  useSyncStatus,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect } from 'react';

import { CHESS_PUZZLE_FEED_TABLE } from '@libs/db/shared/chess-tables';

/**
 * Puzzle feed rows come from the auto-subscribed `chess_puzzles` stream
 * (source: `chess_puzzle_sync_pool`). Explicit band subscriptions previously
 * reached 500/500 downloaded with hasSynced stuck false and 0 local rows.
 */
export function useChessPuzzleFeedSubscription(): void {
  // #region agent log
  const syncStatus = useSyncStatus();
  const engine = useSyncEngine();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let tables: unknown = null;
      let feedCount: unknown = null;
      let psDataCount: unknown = null;
      try {
        tables = await engine.db.query<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type IN ('table','view') AND (name LIKE '%puzzle%' OR name LIKE 'ps_data%puzzle%') ORDER BY name`
        );
        feedCount = await engine.db.query<{ n: number }>(
          `SELECT count(*) AS n FROM ${CHESS_PUZZLE_FEED_TABLE.tableName}`
        );
        psDataCount = await engine.db.query<{ n: number }>(
          `SELECT count(*) AS n FROM ps_data__${CHESS_PUZZLE_FEED_TABLE.tableName}`
        );
      } catch (error) {
        tables = { error: String(error) };
      }
      if (cancelled) return;
      fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-Z',location:'use-chess-puzzle-feed-subscription.ts',message:'auto-feed local sqlite probe',data:{connection:syncStatus.connection,online:syncStatus.online,hasSynced:syncStatus.hasSynced,tables,feedCount,psDataCount},timestamp:Date.now()})}).catch(()=>{});
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, syncStatus.connection, syncStatus.hasSynced, syncStatus.online]);
  // #endregion
}
