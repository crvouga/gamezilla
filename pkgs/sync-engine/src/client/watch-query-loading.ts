import type { SyncEngineStatus } from './sync-status';

/**
 * Loading until the watch has hydrated. After hydration, empty results are
 * empty — do not key off `hasEverSynced` / reconnect flaps (those used to pin
 * list UIs on a spinner forever when the latch briefly read false).
 */
export function computeWatchQueryIsLoading({
  hydrated,
  rows: _rows,
  status: _status,
}: {
  hydrated: boolean;
  rows: readonly unknown[];
  status: SyncEngineStatus;
}): boolean {
  return !hydrated;
}
