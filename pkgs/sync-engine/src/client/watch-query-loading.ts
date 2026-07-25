import type { SyncEngineStatus } from './sync-status';

/**
 * Loading until the watch has hydrated; after that, empty results stay empty
 * (no process cache of prior rows). Empty queries stay loading only until this
 * DB has ever completed a first sync — not while mid-session `hasSynced` flaps
 * or reconnects (those used to pin Spaces/lists on a spinner forever).
 */
export function computeWatchQueryIsLoading({
  hydrated,
  rows,
  status,
}: {
  hydrated: boolean;
  rows: readonly unknown[];
  status: SyncEngineStatus;
}): boolean {
  if (!hydrated) {
    return true;
  }
  if (rows.length > 0) {
    return false;
  }
  return !status.hasEverSynced;
}
