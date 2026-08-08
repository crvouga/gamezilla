import type { PubSub } from '@pkgs/pubsub/interface';
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import { createSqlWatch } from '../queries/client/sql-watch';
import { createTableChangeBus } from '../queries/client/table-change-bus';
import type { QueryRegistry, QueryResponse } from '../queries/core/types';
import '../queries/shared/tiger-invariants';
import type { QueryChannelsCtx } from '../shared/push-payload';
import type { AppLifecycle } from './app-lifecycle';
import { attachPush } from './attach-push';
import {
  clearLocalCache,
  type LocalDomainSchema,
  type LocalMigratePhase,
  migrateLocalSchema,
} from './local-schema-migrate';
import {
  createLocalSyncStatusStore,
  type LocalSyncStatusStore,
} from './local-sync-status';
import {
  MutationUploadQueue,
  type MutationUploadResult,
  type MutationUploadRow,
} from './mutation-upload-queue';
import {
  buildOptimisticFanout,
  createOutboundLiveBuffer,
  type OutboundLiveBuffer,
  publishOptimisticFanout,
} from './optimistic-fanout';
import { createSharedWatchRegistry } from './shared-watch-registry';
import type { CreateId, Timers } from './sim-ports';
import { createSubscribeQueries } from './subscribe-queries';
import {
  type QueryRequest,
  type QuerySubscription,
  type QuerySubscriptionSpec,
  SubscriptionRuntime,
} from './subscription-runtime';
import type { SyncEngine } from './sync-engine-port';
import { createTableChangeSqlClient } from './table-change-sql-client';

export type SyncEnginePushOptions = {
  readonly queryRegistry: QueryRegistry;
  readonly createPubSub: () => PubSub;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly onBindTopicRefresh?: (refresh: () => void) => void;
  /** When true, apply contiguous push row images (default false). */
  readonly rowImageFanout?: boolean;
  /**
   * When true, queue optimistic fanout while pubsub is detached / down and
   * flush on attach. Default false = skip (peers wait for upload/sync).
   */
  readonly bufferOutboundLive?: boolean;
};

export type CreateLocalSyncEngineOptions = {
  readonly db: SqlClient;
  readonly localSchema: LocalDomainSchema;
  readonly mutationRegistry: MutationRegistry;
  readonly getMutationEnv: () => MutationEnv;
  readonly getClientId: () => string;
  /** Session-scoped queries held for the engine lifetime (paint gate waits). */
  readonly sessionQueries: readonly QuerySubscriptionSpec[];
  readonly postQueries: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly postMutations: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
  readonly isAuthRevoked: (error: unknown) => boolean;
  readonly deleteDatabase: () => Promise<void>;
  /**
   * Optional pubsub push. When omitted the engine hydrates once at connect
   * and stays on that snapshot until reconnect — no periodic poll.
   */
  readonly push?: SyncEnginePushOptions;
  readonly lifecycle?: AppLifecycle;
  /** Virtual clock / timers / RNG for deterministic simulation. */
  readonly now?: () => number;
  readonly random?: () => number;
  readonly timers?: Timers;
  readonly createId?: CreateId;
  /**
   * Override local schema epoch (default {@link SCHEMA_EPOCH}).
   * Used by the deterministic sim for epoch-bump scenarios.
   */
  readonly schemaEpoch?: number;
  /**
   * Boundary hook during local migrate (sim crash / fault injection).
   * Phases: before → afterCacheWipe → afterEnsure → done.
   */
  readonly onLocalMigratePhase?: (
    phase: LocalMigratePhase
  ) => void | Promise<void>;
};

type LocalEngineState = {
  readonly options: CreateLocalSyncEngineOptions;
  readonly bus: ReturnType<typeof createTableChangeBus>;
  readonly appDb: SqlClient;
  readonly status: LocalSyncStatusStore;
  readonly runtime: SubscriptionRuntime;
  readonly uploadQueue: MutationUploadQueue;
  readonly watches: ReturnType<typeof createSharedWatchRegistry>;
  readonly sessionHandles: readonly QuerySubscription[];
  readonly outboundLive: OutboundLiveBuffer | null;
  connected: boolean;
  revokePromise: Promise<void> | null;
  disposePush: (() => void) | null;
  pushPubSub: PubSub | null;
};

type LocalEngineStateRef = { current: LocalEngineState | null };

function readState(ref: LocalEngineStateRef): LocalEngineState {
  if (ref.current === null)
    throw new Error('Local sync engine not initialized');
  return ref.current;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mergeDeps(state: LocalEngineState) {
  return {
    db: state.options.db,
    registry: state.options.mutationRegistry,
    env: state.options.getMutationEnv(),
    bus: state.bus,
    clientId: state.options.getClientId(),
  };
}

function handleError(state: LocalEngineState, error: unknown): void {
  if (state.options.isAuthRevoked(error)) {
    state.revokePromise ??= revokeDatabase(state).finally(() => {
      state.revokePromise = null;
    });
    void state.revokePromise;
    return;
  }
  state.status.patch({ online: false, lastError: errorMessage(error) });
}

function createState(options: CreateLocalSyncEngineOptions): LocalEngineState {
  const bus = createTableChangeBus();
  const appDb = createTableChangeSqlClient(options.db, bus);
  const status = createLocalSyncStatusStore();
  const stateRef: LocalEngineStateRef = { current: null };
  const runtime = new SubscriptionRuntime({
    db: options.db,
    postQueries: options.postQueries,
    ...(options.lifecycle !== undefined
      ? { lifecycle: options.lifecycle }
      : {}),
    ...(options.timers !== undefined ? { timers: options.timers } : {}),
    getMergeDeps: () => mergeDeps(readState(stateRef)),
    onError: (error) => handleError(readState(stateRef), error),
    onSynced: () =>
      status.patch({
        connection: 'connected',
        online: true,
        hasSynced: true,
        lastError: null,
      }),
  });
  const sessionHandles = options.sessionQueries.map((spec) =>
    runtime.subscribe(spec)
  );
  const uploadQueue = new MutationUploadQueue({
    db: options.db,
    bus,
    clientId: options.getClientId,
    postBatch: options.postMutations,
    onAckFence: () => {
      readState(stateRef).runtime.bumpGenerations();
    },
    onError: (error) => handleError(readState(stateRef), error),
    ...(options.timers !== undefined ? { timers: options.timers } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  bus.subscribe((tables) => {
    if (tables.has('_mutations')) uploadQueue.wake();
  });
  const bufferOutbound = options.push?.bufferOutboundLive === true;
  const state: LocalEngineState = {
    options,
    bus,
    appDb,
    status,
    runtime,
    uploadQueue,
    watches: createSharedWatchRegistry((query) =>
      createSqlWatch({ db: appDb, bus, query })
    ),
    sessionHandles,
    outboundLive: bufferOutbound ? createOutboundLiveBuffer() : null,
    connected: false,
    revokePromise: null,
    disposePush: null,
    pushPubSub: null,
  };
  stateRef.current = state;
  return state;
}

function flushOutboundLive(state: LocalEngineState): void {
  const pubsub = state.pushPubSub;
  const buf = state.outboundLive;
  if (pubsub === null || buf === null) return;
  void buf.flush(pubsub);
}

function attachPushIfConfigured(state: LocalEngineState): void {
  const push = state.options.push;
  if (push === undefined || state.disposePush !== null) {
    return;
  }
  try {
    let pubsub = push.createPubSub();
    state.pushPubSub = pubsub;
    state.disposePush = attachPush({
      pubsub,
      runtime: state.runtime,
      queryRegistry: push.queryRegistry,
      getChannelsCtx: push.getChannelsCtx,
      db: state.options.db,
      getMergeDeps: () => mergeDeps(state),
      ...(push.rowImageFanout === true ? { rowImageFanout: true } : {}),
      remakePubSub: () => {
        pubsub = push.createPubSub();
        return pubsub;
      },
      onPubSubChanged: (next) => {
        state.pushPubSub = next;
        flushOutboundLive(state);
      },
      ...(push.onBindTopicRefresh !== undefined
        ? { onBindTopicRefresh: push.onBindTopicRefresh }
        : {}),
      ...(state.options.timers !== undefined
        ? { timers: state.options.timers }
        : {}),
      onTablesChanged: (listener) => state.bus.subscribe(listener),
    });
    flushOutboundLive(state);
  } catch (error) {
    console.warn(
      '[sync] attachPush failed; continuing without live push',
      error
    );
  }
}

function detachPush(state: LocalEngineState): void {
  state.disposePush?.();
  state.disposePush = null;
  state.pushPubSub = null;
}

function notifyLocalMutation(
  state: LocalEngineState,
  mutation: Mutation<unknown>,
  args: unknown
): void {
  const push = state.options.push;
  if (push === undefined || push.rowImageFanout !== true) return;
  const pubsub = state.pushPubSub;
  if (pubsub !== null && pubsub.status() === 'connected') {
    void publishOptimisticFanout({
      pubsub,
      db: state.options.db,
      env: state.options.getMutationEnv(),
      mutation,
      args,
    });
    return;
  }
  if (state.outboundLive === null) return;
  void buildOptimisticFanout({
    db: state.options.db,
    env: state.options.getMutationEnv(),
    mutation,
    args,
  }).then((items) => {
    if (items.length === 0) return;
    state.outboundLive?.enqueue(items);
    flushOutboundLive(state);
  });
}

async function connectState(state: LocalEngineState): Promise<void> {
  if (state.connected) {
    state.uploadQueue.wake();
    state.runtime.wakeAll();
    return;
  }
  state.connected = true;
  state.status.patch({
    connection: 'connecting',
    online: true,
    lastError: null,
  });
  state.uploadQueue.start();
  state.runtime.start();
  attachPushIfConfigured(state);
  state.status.patch({ connection: 'syncing' });
}

async function disconnectState(state: LocalEngineState): Promise<void> {
  state.connected = false;
  detachPush(state);
  state.runtime.stop();
  await state.uploadQueue.stop();
  state.status.patch({ connection: 'disconnected', hasSynced: false });
}

async function revokeDatabase(state: LocalEngineState): Promise<void> {
  state.connected = false;
  detachPush(state);
  state.runtime.stop();
  await state.uploadQueue.stop();
  await state.options.db.disconnect();
  await state.options.deleteDatabase();
  state.status.reset();
}

async function clearState(
  state: LocalEngineState,
  reason: 'cache' | 'revoked'
): Promise<void> {
  if (reason === 'revoked') {
    await revokeDatabase(state);
    return;
  }
  const reconnect = state.connected;
  await disconnectState(state);
  await clearLocalCache(state.options.db, state.options.localSchema);
  state.runtime.reset();
  state.bus.emit([
    ...state.options.localSchema.cacheTableNames,
    '_scope_meta',
    'write_rejections',
  ]);
  if (reconnect) await connectState(state);
}

function toEngine(state: LocalEngineState): SyncEngine {
  const subscribeQuery: SyncEngine['subscribeQuery'] = (name, params) =>
    state.runtime.subscribe({
      name,
      params,
    });
  return {
    db: state.appDb,
    watch: <T extends Record<string, unknown>>(query: Sql<T>) =>
      state.watches.watch(query),
    connect: () => connectState(state),
    disconnect: () => disconnectState(state),
    clearLocalData: (args) => clearState(state, args?.reason ?? 'cache'),
    waitForFirstSync: () =>
      Promise.all(state.sessionHandles.map((h) => h.waitForFirstSync())).then(
        () => undefined
      ),
    refreshQueries: () => state.runtime.wakeAllAndDrain(),
    subscribeQuery,
    subscribeQueries: createSubscribeQueries(subscribeQuery),
    status: state.status.status,
    wakeUploads: () => state.uploadQueue.wake(),
    notifyLocalMutation: (mutation, args) =>
      notifyLocalMutation(state, mutation, args),
  };
}

/** Creates the migrated expo-sqlite-backed local sync engine. */
export async function createLocalSyncEngine(
  options: CreateLocalSyncEngineOptions
): Promise<SyncEngine> {
  const merged: CreateLocalSyncEngineOptions = {
    ...options,
    mutationRegistry: withFrameworkMutations(options.mutationRegistry),
  };
  await migrateLocalSchema(merged.db, merged.localSchema, {
    ...(merged.schemaEpoch !== undefined
      ? { schemaEpoch: merged.schemaEpoch }
      : {}),
    ...(merged.onLocalMigratePhase !== undefined
      ? { onLocalMigratePhase: merged.onLocalMigratePhase }
      : {}),
  });
  return toEngine(createState(merged));
}
