import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, useMemo } from 'react';

/**
 * Poll the bounded puzzle-pool query while the feed is mounted.
 */
export function useChessPuzzleFeedSubscription(): void {
  const sync = useSyncEngine();
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
