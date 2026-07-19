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
  // #region agent log
  const debugLastLogRef = useRef('');
  if (sql.includes('FROM spaces')) {
    const source =
      rows.length > 0
        ? 'live'
        : cachedRows.length > 0
          ? 'cache'
          : reconnecting && prevRowsRef.current.length > 0
            ? 'prevRows'
            : 'live-empty';
    const logKey = JSON.stringify({
      sql: sql.slice(0, 60),
      liveN: rows.length,
      cacheN: cachedRows.length,
      prevN: prevRowsRef.current.length,
      source,
      conn: status.connection,
      hasSynced: status.hasSynced,
      hydrated,
      confirmedEmpty: cached?.confirmedEmpty ?? false,
    });
    if (debugLastLogRef.current !== logKey) {
      debugLastLogRef.current = logKey;
      fetch(
        'http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '11af44',
          },
          body: JSON.stringify({
            sessionId: '11af44',
            hypothesisId: 'A,B',
            location: 'sync-engine-context.tsx:useWatchQuery',
            message: 'spaces watch displayRows source',
            data: {
              sqlPrefix: sql.slice(0, 80),
              paramsKey,
              liveRowIds: rows.map((r) => (r as { id?: unknown }).id),
              cachedRowIds: cachedRows.map((r) => (r as { id?: unknown }).id),
              prevRowIds: prevRowsRef.current.map(
                (r) => (r as { id?: unknown }).id
              ),
              source,
              connection: status.connection,
              hasSynced: status.hasSynced,
              hasEverSynced: status.hasEverSynced,
              hydrated,
              confirmedEmpty: cached?.confirmedEmpty ?? false,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
    }
  }
  // #endregion
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

function readRowField<T>(
  rows: readonly Record<string, unknown>[],
  column: string
): T | null {
  const row = rows[0];
  if (row === undefined) return null;
  const raw = row[column];
  return (raw as T | null) ?? null;
}

/**
 * Subscribe to a multi-column SQL watch but only re-render when `column`
 * changes (`Object.is` on the field value). Shares the underlying watch via
 * the engine registry when the same `(sql, params)` is used elsewhere.
 */
export function useWatchField<T>(
  sql: string,
  params: readonly unknown[] = [],
  column = 'value'
): { readonly value: T | null; readonly isLoading: boolean } {
  const engine = useSyncEngine();
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const subscription = useMemo(
    () => engine.watch<Record<string, unknown>>(sql, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsKey replaces params
    [engine, sql, paramsKey]
  );
  const value = useSyncExternalStore(
    subscription.subscribe,
    () => readRowField<T>(subscription.getSnapshot(), column),
    () => readRowField<T>(subscription.getSnapshot(), column)
  );
  const hydrated = useSyncExternalStore(
    subscription.subscribe,
    subscription.getHydrated,
    subscription.getHydrated
  );
  return { value, isLoading: !hydrated && value === null };
}

export function useWatchValue<T>(
  sql: string,
  params: readonly unknown[] = [],
  column = 'value'
): { readonly value: T | null; readonly isLoading: boolean } {
  return useWatchField<T>(sql, params, column);
}
