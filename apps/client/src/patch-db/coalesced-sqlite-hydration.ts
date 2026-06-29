import type { PatchDb } from '@pkgs/patch-db/interface';
import { hydrateInMemoryStoreFromSqlite } from '@pkgs/patch-db/react/hydrate-in-memory-store';
import type { InMemoryEntityStore } from '@pkgs/patch-db/react/in-memory-entity-store';
import { refreshPatchDbQueryCacheForDb } from '@pkgs/patch-db/react/query-cache';
import type { SubscribablePatchDbLike } from '@pkgs/patch-db/subscribable';

/** Serializes SQLite hydration so push/poll invalidations do not overlap reads. */
export function createCoalescedSqliteHydration(args: {
  local: PatchDb;
  store: InMemoryEntityStore;
  decoratedDb: SubscribablePatchDbLike;
}): () => void {
  let hydrateQueued = false;
  let hydrateInFlight: Promise<void> | null = null;

  return () => {
    if (hydrateInFlight !== null) {
      hydrateQueued = true;
      return;
    }
    hydrateInFlight = (async () => {
      do {
        hydrateQueued = false;
        await hydrateInMemoryStoreFromSqlite(args.local, args.store);
        refreshPatchDbQueryCacheForDb(args.decoratedDb);
      } while (hydrateQueued);
    })().finally(() => {
      hydrateInFlight = null;
    });
  };
}
