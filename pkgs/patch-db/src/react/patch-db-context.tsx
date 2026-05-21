import { createContext, useContext } from 'react';
import type { PubSub } from '@pkgs/pub-sub/interface';
import type { SyncPatchDb } from '../impl-sync/impl-sync';
import type { SubscribablePatchDbLike } from '../subscribable';

/**
 * Single-instance, app-lifetime patch-db value. There is no longer a "stack"
 * abstraction: `db` is the decorated subscribable patch-db, and `sync` /
 * `pubSub` are exposed as siblings for the few callers that need to schedule
 * sync work or listen to sync topics directly.
 */
export type PatchDbValue = {
  readonly db: SubscribablePatchDbLike;
  readonly sync: SyncPatchDb;
  readonly pubSub: PubSub;
};

const PatchDbContext = createContext<PatchDbValue | null>(null);

export const PatchDbContextProvider = PatchDbContext.Provider;

function usePatchDbValue(): PatchDbValue {
  const v = useContext(PatchDbContext);
  if (v === null) {
    throw new Error(
      'usePatchDb*: PatchDbContext.Provider missing — wrap with the PatchDbProvider in AppProviders'
    );
  }
  return v;
}

/** The decorated, subscribable patch-db. Use this for read/write/subscribe. */
export function usePatchDb(): SubscribablePatchDbLike {
  return usePatchDbValue().db;
}

/** Sync engine — schedule polls, mark patches as already-on-remote, etc. */
export function useSync(): SyncPatchDb {
  return usePatchDbValue().sync;
}

/** Process-local pub-sub used for sync topics (`PATCHES_DB_TOPIC`, etc.). */
export function usePubSub(): PubSub {
  return usePatchDbValue().pubSub;
}
