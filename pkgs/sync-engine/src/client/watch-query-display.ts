import type { SyncEngineStatus } from './sync-status';

export function isSyncReconnecting(status: SyncEngineStatus): boolean {
  return (
    status.connection === 'disconnected' || status.connection === 'connecting'
  );
}

export function isStableSyncedEmpty(status: SyncEngineStatus): boolean {
  return status.connection === 'connected' && status.hasSynced;
}

/**
 * Prefer live rows. Hold cached/previous rows only before hydrate or while
 * reconnecting — never after a hydrated empty watch while connected (that
 * used to keep ended space IDs on the lobby list).
 */
export function resolveWatchQueryDisplayRows<T>({
  rows,
  cachedRows,
  reconnecting,
  prevRows,
  hydrated,
}: {
  rows: readonly T[];
  cachedRows: readonly T[];
  reconnecting: boolean;
  prevRows: readonly T[];
  hydrated: boolean;
}): readonly T[] {
  if (rows.length > 0) {
    return rows;
  }
  if (!hydrated || reconnecting) {
    if (cachedRows.length > 0) {
      return cachedRows;
    }
    if (prevRows.length > 0) {
      return prevRows;
    }
  }
  return rows;
}

export function shouldConfirmWatchQueryEmpty({
  reconnecting,
  status,
  hydrated,
}: {
  reconnecting: boolean;
  status: SyncEngineStatus;
  hydrated: boolean;
}): boolean {
  if (reconnecting) {
    return false;
  }
  return isStableSyncedEmpty(status) || hydrated;
}
