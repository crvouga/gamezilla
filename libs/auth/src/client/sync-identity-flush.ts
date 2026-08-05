import { clearWatchQueryCache } from '@pkgs/sync-engine/client/watch-query-cache';

/**
 * Called after `/auth/refresh` writes a new `lastLocalAccountId`. Per-identity
 * SQLite remounts via {@link SyncEngineBoot}; this only drops stale watch
 * snapshots so UI does not briefly read the previous identity's rows.
 *
 * Space presence latches are cleared in `useSyncEngineBootState` on the same
 * identity change (auth must not import `@libs/spaces`).
 */
export async function flushSyncIdentityOnSignIn(): Promise<void> {
  clearWatchQueryCache();
}
