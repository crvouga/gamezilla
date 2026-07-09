import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { SyncEngine } from './sync-engine-port';

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
  const status = useSyncStatus();
  const isLoading = !status.hasSynced && rows.length === 0;
  return { rows, isLoading };
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
