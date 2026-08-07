import { useSyncEngineInstance } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, useMemo } from 'react';

/**
 * Hydrate the puzzle-pool query while the feed is mounted.
 */
export function useChessPuzzleFeedSubscription(): void {
  // Stable engine — reactive useSyncEngine() would resubscribe on every status patch.
  const sync = useSyncEngineInstance();
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
  useEffect(() => {
    const handle = sync.subscribeQueries(specs);
    return () => handle.unsubscribe();
  }, [sync, specs]);
}
