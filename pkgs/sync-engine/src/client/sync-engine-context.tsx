import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { SyncEngine } from './sync-engine-port';
import type { SyncEngineStatus } from './sync-status';
import {
  clearWatchQueryCache,
  readWatchQueryCache,
  watchQueryCacheKey,
  writeWatchQueryCache,
} from './watch-query-cache';
import { computeWatchQueryIsLoading } from './watch-query-loading';

export { clearWatchQueryCache };

const Ctx = createContext<SyncEngine | null>(null);

export function SyncEngineProvider({
  value,
  children,
}: {
  value: SyncEngine;
  children: ReactNode;
}): ReactNode {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSyncEngine(): SyncEngine {
  const value = useContext(Ctx);
  if (value === null) {
    throw new Error(
      'useSyncEngine: provider missing — mount inside SyncEngineProvider'
    );
  }
  return value;
}

export function useSyncStatus() {
  const engine = useSyncEngine();
  const status = engine.status;
  return useSyncExternalStore(
    status.subscribe,
    status.getSnapshot,
    status.getSnapshot
  );
}

function isSyncReconnecting(status: SyncEngineStatus): boolean {
  return (
    status.connection === 'disconnected' || status.connection === 'connecting'
  );
}

function isStableSyncedEmpty(status: SyncEngineStatus): boolean {
  return status.connection === 'connected' && status.hasSynced;
}

function updateWatchQueryCacheForSnapshot<T extends Record<string, unknown>>({
  cacheKey,
  rows,
  status,
  prevRowsRef,
  hadRowsRef,
}: {
  cacheKey: string;
  rows: readonly T[];
  status: SyncEngineStatus;
  prevRowsRef: { current: readonly T[] };
  hadRowsRef: { current: boolean };
}): void {
  if (rows.length > 0) {
    hadRowsRef.current = true;
    prevRowsRef.current = rows;
    writeWatchQueryCache(cacheKey, { rows, confirmedEmpty: false });
    return;
  }
  if (isStableSyncedEmpty(status)) {
    writeWatchQueryCache(cacheKey, { rows: [], confirmedEmpty: true });
  }
}

function resolveWatchQueryDisplayRows<T extends Record<string, unknown>>({
  rows,
  cachedRows,
  reconnecting,
  prevRows,
}: {
  rows: readonly T[];
  cachedRows: readonly T[];
  reconnecting: boolean;
  prevRows: readonly T[];
}): readonly T[] {
  if (rows.length > 0) {
    return rows;
  }
  if (cachedRows.length > 0) {
    return cachedRows;
  }
  if (reconnecting && prevRows.length > 0) {
    return prevRows;
  }
  return rows;
}

export function useWatchSubscription<T>(
  subscription: ReturnType<SyncEngine['watch']>
): T {
  return useSyncExternalStore(
    subscription.subscribe,
    subscription.getSnapshot as () => T,
    subscription.getSnapshot as () => T
  );
}

export function useWatchQuery<T extends Record<string, unknown>>(
  sql: string,
  params: readonly unknown[] = []
): { readonly rows: readonly T[]; readonly isLoading: boolean } {
  const engine = useSyncEngine();
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const subscription = useMemo(
    () => engine.watch<T>(sql, params),
    // paramsKey stabilizes array identity for watch subscription identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsKey replaces params
    [engine, sql, paramsKey]
  );
  const rows = useWatchSubscription<readonly T[]>(subscription);
  const hydrated = useSyncExternalStore(
    subscription.subscribe,
    subscription.getHydrated,
    subscription.getHydrated
  );
  const status = useSyncStatus();
  const cacheKey = watchQueryCacheKey(sql, paramsKey);
  const prevRowsRef = useRef<readonly T[]>([]);
  const hadRowsRef = useRef(false);
  updateWatchQueryCacheForSnapshot({
    cacheKey,
    rows,
    status,
    prevRowsRef,
    hadRowsRef,
  });
  const cached = readWatchQueryCache(cacheKey);
  const reconnecting = isSyncReconnecting(status);
  const cachedRows = (cached?.rows ?? []) as readonly T[];
  const displayRows = resolveWatchQueryDisplayRows({
    rows,
    cachedRows,
    reconnecting,
    prevRows: prevRowsRef.current,
  });
  const isLoading = computeWatchQueryIsLoading({
    hydrated,
    displayRows,
    hadRows: hadRowsRef.current,
    confirmedEmpty: cached?.confirmedEmpty ?? false,
    status,
    reconnecting,
  });
  return { rows: displayRows, isLoading };
}

export function useWatchOne<T extends Record<string, unknown>>(
  sql: string,
  params: readonly unknown[] = []
): { readonly row: T | null; readonly isLoading: boolean } {
  const { rows, isLoading } = useWatchQuery<T>(sql, params);
  return { row: rows[0] ?? null, isLoading };
}

export function useWatchValue<T>(
  sql: string,
  params: readonly unknown[] = [],
  column = 'value'
): { readonly value: T | null; readonly isLoading: boolean } {
  const { row, isLoading } = useWatchOne<Record<string, unknown>>(sql, params);
  if (row === null) {
    return { value: null, isLoading };
  }
  const raw = row[column];
  return { value: (raw as T | null) ?? null, isLoading };
}
