import { useSyncEngineInstance } from '@pkgs/sync-engine/solid';
import { onCleanup } from 'solid-js';

/** Hydrate the puzzle pool for the lifetime of the mounted feed. */
export function useChessPuzzleFeedSubscription(): void {
  const sync = useSyncEngineInstance();
  const handle = sync.subscribeQueries([
    { name: 'chessPuzzlePool', params: { ratingMin: 0, ratingMax: 4000 } },
  ]);
  onCleanup(() => handle.unsubscribe());
}
