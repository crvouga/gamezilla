import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { Sql } from '@pkgs/sql';
import type { SyncEngine } from './sync-engine-port';
import { computeWatchQueryIsLoading } from './watch-query-loading';

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
  query: Sql<T>
): { readonly rows: readonly T[]; readonly isLoading: boolean } {
  const engine = useSyncEngine();
  const sqlText = query.sql;
  const paramsKey = useMemo(() => JSON.stringify(query.values), [query.values]);
  const subscription = useMemo(
    () => engine.watch(query),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsKey replaces values
    [engine, sqlText, paramsKey]
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
  query: Sql<T>
): { readonly row: T | null; readonly isLoading: boolean } {
  const { rows, isLoading } = useWatchQuery(query);
  return { row: rows[0] ?? null, isLoading };
}

function readRowField<T extends Record<string, unknown>, K extends keyof T>(
  rows: readonly T[],
  column: K
): T[K] | null {
  const row = rows[0];
  if (row === undefined) return null;
  const raw = row[column];
  return (raw as T[K] | null) ?? null;
}

/**
 * Subscribe to a multi-column SQL watch but only re-render when `column`
 * changes (`Object.is` on the field value). Shares the underlying watch via
 * the engine registry when the same query is used elsewhere.
 */
export function useWatchField<
  T extends Record<string, unknown>,
  K extends keyof T & string,
>(
  query: Sql<T>,
  column: K
): { readonly value: T[K] | null; readonly isLoading: boolean } {
  const engine = useSyncEngine();
  const sqlText = query.sql;
  const paramsKey = useMemo(() => JSON.stringify(query.values), [query.values]);
  const subscription = useMemo(
    () => engine.watch(query),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsKey replaces values
    [engine, sqlText, paramsKey]
  );
  const getSnapshot = useCallback(
    () => readRowField(subscription.getSnapshot(), column),
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

export function useWatchValue<
  T extends Record<string, unknown> & { readonly value: unknown },
>(
  query: Sql<T>
): { readonly value: T['value'] | null; readonly isLoading: boolean } {
  return useWatchField(query, 'value');
}
