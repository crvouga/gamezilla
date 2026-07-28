import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { SyncEngine } from './sync-engine-port';
import { clearWatchQueryCache } from './watch-query-cache';
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

export function useWatchSubscription<T>(
  subscription: ReturnType<SyncEngine['watch']>
): T {
  return useSyncExternalStore(
    subscription.subscribe,
    subscription.getSnapshot as () => T,
    subscription.getSnapshot as () => T
  );
}

/**
 * Live SQL watch — always returns the current SQLite snapshot (no process
 * row cache). `isLoading` is true until the watch hydrates.
 */
export function useWatchQuery<T extends Record<string, unknown>>(
  sql: string,
  params: readonly unknown[] = []
): { readonly rows: readonly T[]; readonly isLoading: boolean } {
  const engine = useSyncEngine();
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const subscription = useMemo(
    () => engine.watch<T>(sql, params),
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
  const isLoading = computeWatchQueryIsLoading({
    hydrated,
    rows,
    status,
  });
  return { rows, isLoading };
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
  const getSnapshot = useCallback(
    () => readRowField<T>(subscription.getSnapshot(), column),
    [subscription, column]
  );
  const value = useSyncExternalStore(
    subscription.subscribe,
    getSnapshot,
    getSnapshot
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
