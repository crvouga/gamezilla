import type { SyncEngineStatus } from './sync-status';

/**
 * Loading until the watch has hydrated; after that, empty results stay empty
 * (no process cache of prior rows). While reconnecting before first sync of
 * this session, keep showing loading for empty queries.
 */
export function computeWatchQueryIsLoading({
  hydrated,
  rows,
  status,
  reconnecting,
}: {
  hydrated: boolean;
  rows: readonly unknown[];
  status: SyncEngineStatus;
  reconnecting: boolean;
}): boolean {
  if (!hydrated) {
    return true;
  }
  if (rows.length > 0) {
    return false;
  }
  return !status.hasEverSynced || !status.hasSynced || reconnecting;
}
