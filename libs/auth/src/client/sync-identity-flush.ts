import { clearWatchQueryCache } from '@pkgs/sync-engine/client/watch-query-cache';

/**
 * Called after `/auth/refresh` writes a new `lastLocalAccountId`. Per-account
 * SQLite remounts via {@link SyncEngineBoot}; this only drops stale watch
 * snapshots so UI does not briefly read the previous identity's rows.
 *
 * Space presence latches are cleared in `useSyncEngineBootState` on the same
 * identity change (auth must not import `@libs/spaces`).
 *
 * Does **not** call `disconnectAndClear` — that would wipe a warm account DB
 * still open during the remount race.
 */
export async function flushSyncIdentityOnSignIn(): Promise<void> {
  clearWatchQueryCache();
}
