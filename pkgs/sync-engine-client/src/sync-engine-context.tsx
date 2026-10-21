/** @jsxImportSource solid-js */

import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import {
  type Accessor,
  createComputed,
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  type ParentProps,
  untrack,
  useContext,
} from 'solid-js';

import type { SyncEngine, WatchSubscription } from './sync-engine-port';
import type { SyncEngineStatus } from './sync-status';
import { computeWatchQueryIsLoading } from './watch-query-loading';

const EngineContext = createContext<SyncEngine>();

/**
 * Whether the mounted engine's identity matches this tab's selected account
 * (not a sticky prior-account engine during switch). Defaults to `true`.
 */
const PaintGateContext = createContext<Accessor<boolean>>(() => true);

export function SyncEngineProvider(props: ParentProps<{ value: SyncEngine }>) {
  // Stable engine handle: read once on mount by design (not tracked).
  const engine = untrack(() => props.value);
  return (
    <EngineContext.Provider value={engine}>
      {props.children}
    </EngineContext.Provider>
  );
}

export function SyncEnginePaintGateProvider(
  props: ParentProps<{ ready: Accessor<boolean> }>
) {
  // The accessor itself is the reactive value; its identity is stable.
  const ready = untrack(() => props.ready);
  return (
    <PaintGateContext.Provider value={ready}>
      {props.children}
    </PaintGateContext.Provider>
  );
}

/** Raw engine instance (stable; no status subscription). */
export function useSyncEngineInstance(): SyncEngine {
  const engine = useContext(EngineContext);
  if (engine === undefined) {
    throw new Error(
      'useSyncEngine: provider missing — mount inside SyncEngineProvider'
    );
  }
  return engine;
}

/**
 * Integration facade: engine methods plus reactive `status` / `paintReady`
 * accessors. Prefer this over reaching for engine internals.
 */
export type SyncEngineApi = Omit<SyncEngine, 'status'> & {
  /** Live sync status (tracked). */
  readonly status: Accessor<SyncEngineStatus>;
  /** Always-current status read for callbacks (untracked). */
  readonly getStatus: () => SyncEngineStatus;
  /** Whether UI may paint this identity's local data (tracked). */
  readonly paintReady: Accessor<boolean>;
};

export function useSyncEngine(): SyncEngineApi {
  const engine = useSyncEngineInstance();
  const status = createSubscriptionSignal(engine.status);
  const paintReady = useContext(PaintGateContext);
  return {
    db: engine.db,
    watch: engine.watch.bind(engine),
    connect: () => engine.connect(),
    disconnect: () => engine.disconnect(),
    clearLocalData: (options) => engine.clearLocalData(options),
    waitForFirstSync: () => engine.waitForFirstSync(),
    refreshQueries: () => engine.refreshQueries(),
    subscribeQuery: engine.subscribeQuery,
    subscribeQueries: engine.subscribeQueries,
    mutationOutcome: (mutationId) => engine.mutationOutcome(mutationId),
    mutationFeedback: (mutationName, scope) =>
      engine.mutationFeedback(mutationName, scope),
    listRejections: () => engine.listRejections(),
    unheardRefusals: () => engine.unheardRefusals(),
    pendingMutationCount: () => engine.pendingMutationCount(),
    wakeUploads: engine.wakeUploads,
    notifyLocalMutation: engine.notifyLocalMutation,
    registerMutationDrain: engine.registerMutationDrain,
    ensurePush: engine.ensurePush,
    status,
    getStatus: () => engine.status.getSnapshot(),
    paintReady,
  };
}

export type QueryResult<T> = {
  /** Current SQLite snapshot (tracked; `[]` until hydrated). */
  readonly rows: Accessor<readonly T[]>;
  /** True until the watch has hydrated once (tracked). */
  readonly isLoading: Accessor<boolean>;
};

function watchKey(query: Sql<unknown>): string {
  return `${query.sql}\u0000${JSON.stringify(query.values)}`;
}

/**
 * Live SQL watch as signals. `query` is an accessor: when its SQL text or
 * parameters change the previous watch is released and a new one attached.
 */
export function createQuery<T extends Record<string, unknown>>(
  query: Accessor<Sql<T>>
): QueryResult<T> {
  const engine = useSyncEngineInstance();
  const [rows, setRows] = createSignal<readonly T[]>([]);
  const [hydrated, setHydrated] = createSignal(false);
  const key = createMemo(() => watchKey(query()));

  createComputed(() => {
    key();
    const sub: WatchSubscription<readonly T[]> = untrack(() =>
      engine.watch(query())
    );
    const apply = (): void => {
      setRows(() => sub.getSnapshot());
      setHydrated(sub.getHydrated());
    };
    apply();
    onCleanup(sub.subscribe(apply));
  });

  const isLoading = createMemo(() =>
    computeWatchQueryIsLoading({
      hydrated: hydrated(),
      rows: rows(),
      status: engine.status.getSnapshot(),
    })
  );

  return { rows, isLoading };
}
