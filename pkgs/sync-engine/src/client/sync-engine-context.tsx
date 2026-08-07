import type { Sql } from '@pkgs/sql';
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { SyncEnginePaintGateContext } from './sync-engine-paint-gate';
import type { SyncEngine } from './sync-engine-port';
import type { SyncEngineStatus } from './sync-status';
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

/**
 * Integration facade: engine methods plus reactive status / paint gate.
 * Prefer this over reaching for deleted status/subscription/paint hooks.
 */
export type SyncEngineApi = Omit<SyncEngine, 'status'> & {
  /** Live sync status snapshot (re-renders on change). */
  readonly status: SyncEngineStatus;
  /** Always-current status read for callbacks (not a React subscription). */
  readonly getStatus: () => SyncEngineStatus;
  /** Whether UI may paint this identity's local data. */
  readonly paintReady: boolean;
};

/** Raw engine instance for portal re-supply (`SyncEngineProvider` value). */
export function useSyncEngineInstance(): SyncEngine {
  const engine = useContext(Ctx);
  if (engine === null) {
    throw new Error(
      'useSyncEngine: provider missing — mount inside SyncEngineProvider'
    );
  }
  return engine;
}

export function useSyncEngine(): SyncEngineApi {
  const engine = useSyncEngineInstance();
  const status = useSyncExternalStore(
    engine.status.subscribe,
    engine.status.getSnapshot,
    engine.status.getSnapshot
  );
  const paintReady = useContext(SyncEnginePaintGateContext);
  return useMemo(
    () => ({
      db: engine.db,
      watch: engine.watch.bind(engine),
      connect: () => engine.connect(),
      disconnect: () => engine.disconnect(),
      clearLocalData: (options) => engine.clearLocalData(options),
      waitForFirstSync: () => engine.waitForFirstSync(),
      subscribeQuery: engine.subscribeQuery,
      subscribeQueries: engine.subscribeQueries,
      wakeUploads: engine.wakeUploads,
      status,
      getStatus: () => engine.status.getSnapshot(),
      paintReady,
    }),
    [engine, paintReady, status]
  );
}

/**
 * Live SQL watch — always returns the current SQLite snapshot (no process
 * row cache). `isLoading` is true until the watch hydrates.
 */
export function useQuery<T extends Record<string, unknown>>(
  query: Sql<T>
): { readonly rows: readonly T[]; readonly isLoading: boolean } {
  // Stable engine so status/paintReady updates do not recreate watches.
  const engine = useSyncEngineInstance();
  const sqlText = query.sql;
  const paramsKey = useMemo(() => JSON.stringify(query.values), [query.values]);
  const subscription = useMemo(
    () => engine.watch(query),
    [engine, sqlText, paramsKey]
  );
  const rows = useSyncExternalStore(
    subscription.subscribe,
    subscription.getSnapshot as () => readonly T[],
    subscription.getSnapshot as () => readonly T[]
  );
  const hydrated = useSyncExternalStore(
    subscription.subscribe,
    subscription.getHydrated,
    subscription.getHydrated
  );
  const isLoading = computeWatchQueryIsLoading({
    hydrated,
    rows,
    status: engine.status.getSnapshot(),
  });
  return { rows, isLoading };
}
