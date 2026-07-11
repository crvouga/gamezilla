import type { SyncEngineStatus } from './sync-status';

export function computeWatchQueryIsLoading({
  hydrated,
  displayRows,
  hadRows,
  confirmedEmpty,
  status,
  reconnecting,
}: {
  hydrated: boolean;
  displayRows: readonly unknown[];
  hadRows: boolean;
  confirmedEmpty: boolean;
  status: SyncEngineStatus;
  reconnecting: boolean;
}): boolean {
  if (displayRows.length > 0 || hadRows || confirmedEmpty) {
    return false;
  }
  if (!hydrated) {
    return true;
  }
  return !status.hasEverSynced || !status.hasSynced || reconnecting;
}
