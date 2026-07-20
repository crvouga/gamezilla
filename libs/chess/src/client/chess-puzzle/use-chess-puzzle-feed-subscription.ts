import { useSyncEngineSubscriptions } from '@pkgs/sync-engine/client/use-sync-engine-subscriptions';
import { useMemo } from 'react';

/**
 * Explicitly subscribe to the global `chess_puzzles` stream (source:
 * `chess_puzzles` WHERE sync_pool). Relying on auto_subscribe alone left
 * local feed counts at 0 while other streams set hasSynced=true.
 */
export function useChessPuzzleFeedSubscription(): void {
  const specs = useMemo(
    () =>
      [
        {
          stream: 'chess_puzzles',
          params: {},
          priority: 1,
        },
      ] as const,
    []
  );
  useSyncEngineSubscriptions(specs);
}
