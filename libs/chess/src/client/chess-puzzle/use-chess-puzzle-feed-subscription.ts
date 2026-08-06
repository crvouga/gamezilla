import { useSyncEngineSubscriptions } from '@pkgs/sync-engine/client/use-sync-engine-subscriptions';
import { useMemo } from 'react';

/**
 * Poll the bounded puzzle-pool query while the feed is mounted.
 */
export function useChessPuzzleFeedSubscription(): void {
  const specs = useMemo(
    () =>
      [
        {
          name: 'chessPuzzlePool',
          params: { ratingMin: 0, ratingMax: 4000 },
        },
      ] as const,
    []
  );
  useSyncEngineSubscriptions(specs);
}
