import { assert } from '@pkgs/assert';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  listUnackedWriteRejections,
  mutationStatus,
  pendingMutationCount,
} from '../mutations/client/mutation-status';
import type {
  Mutation,
  MutationEnv,
  MutationRegistry,
} from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import {
  createSqlWatch,
  type ScheduleNotify,
} from '../queries/client/sql-watch';
import { createTableChangeBus } from '../queries/client/table-change-bus';
import type { QueryResponse } from '../queries/core/types';
import '../queries/shared/tiger-invariants';
import { withFrameworkTopicMap } from '../shared/framework-topic-map';
import { isSqliteClosedError } from '../shared/is-pubsub-closed-error';
import type { WriteCaptureSnapshot } from '../sql-ast';
import type { AppLifecycle } from './app-lifecycle';
import {
  attachPushIfConfigured,
  type SyncEnginePushOptions,
} from './attach-configured-push';
import type { CreateId, Timers } from './harness-ports';
import { readLastSyncedAtMs } from './last-synced';
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
import { reapplyPendingAfterWipe } from './merge';
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
import { createSubscribeQueries } from './subscribe-queries';
import {
  type QueryRequest,
  type QuerySubscription,
  type QuerySubscriptionSpec,
  SubscriptionRuntime,
} from './subscription-runtime';
import type { SyncEngine } from './sync-engine-port';
import { SyncApiAuthError } from './sync-http-client';
import { createTableChangeSqlClient } from './table-change-sql-client';

export type { SyncEnginePushOptions };

export type CreateLocalSyncEngineOptions = {
  readonly db: SqlClient;
  readonly localSchema: LocalDomainSchema;
  readonly mutationRegistry: MutationRegistry;
  readonly getMutationEnv: () => MutationEnv;
  readonly getClientId: () => string;
  /** Session-scoped queries held for the engine lifetime (`waitForFirstSync`). */
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
   * Optional pubsub push. When omitted the engine still hydrates at connect
   * and refetches on the reconcile tick / reconnect / foreground wake —
   * push is the fast path for peer awareness, not the only path.
   */
  readonly push?: SyncEnginePushOptions;
  readonly lifecycle?: AppLifecycle;
  /** Required nondeterminism ports (wall or harness). */
  readonly now: () => number;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly random?: () => number;
  /**
   * Safety-net refetch interval for missed notify / lost push
   * (default 30s). `<= 0` disables. Harness uses a shorter interval.
   */
  readonly reconcileIntervalMs?: number;
  /**
   * Override local schema epoch (default {@link SCHEMA_EPOCH}).
   * Used by the deterministic harness for epoch-bump scenarios.
   */
  readonly schemaEpoch?: number;
  /**
   * Park mutation uploads until the API origin is reachable. On
   * HttpNetworkError, wait here instead of a timed hammer.
   */
  readonly waitUntilAvailable?: (signal?: AbortSignal | null) => Promise<void>;
  /**
   * Boundary hook during local migrate (harness crash / fault injection).
   * Phases: before → afterCacheWipe → afterEnsure → done.
   */
  readonly onLocalMigratePhase?: (
    phase: LocalMigratePhase
  ) => void | Promise<void>;
  /**
   * Multi-tab web: subscribe to broker `db-changed` (and similar) so this
   * tab's watches / upload queue wake when another tab committed writes.
   */
  readonly subscribeExternalDbChanged?: (listener: () => void) => () => void;
  /**
   * When false, skip the mutation upload loop (sync-follower tabs). Default true.
   */
  readonly enableMutationUpload?: boolean;
  /**
   * Scheduler for watch listener notification (default synchronous). A UI
   * host may inject a deferred scheduler so input paint beats snapshot apply.
   */
  readonly scheduleNotify?: ScheduleNotify;
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
  /** Remake entryChannel / held-row topics after identity switch wake. */
  refreshTopics: (() => void) | null;
  disposeExternalDbChanged: (() => void) | null;
  pushPubSub: PubSub | null;
  /** In-flight local mutation work (MutationClientProvider / harness clients). */
  readonly mutationDrains: Set<() => Promise<void>>;
};

type LocalEngineStateRef = { current: LocalEngineState | null };

function readState(ref: LocalEngineStateRef): LocalEngineState {
  assert.defined(ref.current, 'Local sync engine not initialized');
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
    state.revokePromise ??= revokeDatabase(state)
      .catch((error) => handleError(state, error))
      .finally(() => {
        state.revokePromise = null;
      });
    void state.revokePromise;
    return;
  }
  // Expired is refresh-and-retry only — never sticky lastError / offline.
  if (error instanceof SyncApiAuthError && error.reason === 'expired') {
    return;
  }
  state.status.patch({
    online: false,
    lastError: errorMessage(error),
    // Protocol cut: the app is outdated. Kept until a sync succeeds again.
    ...(error instanceof SyncApiAuthError && error.reason === 'upgrade_required'
      ? { upgradeRequired: true }
      : {}),
  });
}

function createUploadQueue(
  options: CreateLocalSyncEngineOptions,
  bus: ReturnType<typeof createTableChangeBus>,
  stateRef: LocalEngineStateRef
): MutationUploadQueue {
  return new MutationUploadQueue({
    db: options.db,
    bus,
    clientId: options.getClientId,
    postBatch: options.postMutations,
    onAckFence: () => {
      const state = readState(stateRef);
      state.runtime.bumpGenerations();
      state.refreshTopics?.();
    },
    onError: (error) => handleError(readState(stateRef), error),
    timers: options.timers,
    now: options.now,
    ...(options.random !== undefined ? { random: options.random } : {}),
    ...(options.waitUntilAvailable !== undefined
      ? { waitUntilAvailable: options.waitUntilAvailable }
      : {}),
  });
}

/** Another tab / process changed the shared DB: re-run every local watch. */
function relayExternalDbChanges(
  options: CreateLocalSyncEngineOptions,
  bus: ReturnType<typeof createTableChangeBus>
): (() => void) | null {
  if (options.subscribeExternalDbChanged === undefined) return null;
  const externalTables = [
    ...options.localSchema.cacheTableNames,
    'sync_engine_mutations',
    'sync_engine_scope_meta',
    'sync_engine_write_rejections',
  ] as const;
  return options.subscribeExternalDbChanged(() => {
    bus.emit(externalTables);
  });
}

function createState(options: CreateLocalSyncEngineOptions): LocalEngineState {
  const bus = createTableChangeBus();
  const appDb = createTableChangeSqlClient(options.db, bus);
  const status = createLocalSyncStatusStore();
  const stateRef: LocalEngineStateRef = { current: null };
  const runtime = new SubscriptionRuntime({
    db: options.db,
    postQueries: options.postQueries,
    ...(options.push?.queryRegistry !== undefined
      ? { queryRegistry: options.push.queryRegistry }
      : {}),
    ...(options.lifecycle !== undefined
      ? { lifecycle: options.lifecycle }
      : {}),
    timers: options.timers,
    ...(options.reconcileIntervalMs !== undefined
      ? { reconcileIntervalMs: options.reconcileIntervalMs }
      : {}),
    getMergeDeps: () => mergeDeps(readState(stateRef)),
    onError: (error) => handleError(readState(stateRef), error),
    onSynced: () =>
      status.patch({
        connection: 'connected',
        online: true,
        hasSynced: true,
        lastSyncedAtMs: options.now(),
        lastError: null,
        upgradeRequired: false,
      }),
  });
  const sessionHandles = options.sessionQueries.map((spec) =>
    runtime.subscribe({ ...spec, settleOnNetworkError: true })
  );
  const uploadQueue = createUploadQueue(options, bus, stateRef);
  bus.subscribe((tables) => {
    if (tables.has('sync_engine_mutations')) uploadQueue.wake();
  });
  const bufferOutbound = options.push?.bufferOutboundLive === true;
  const disposeExternalDbChanged = relayExternalDbChanges(options, bus);
  const state: LocalEngineState = {
    options,
    bus,
    appDb,
    mutationDrains: new Set(),
    status,
    runtime,
    uploadQueue,
    watches: createSharedWatchRegistry((query) =>
      createSqlWatch({
        db: appDb,
        bus,
        query,
        ...(options.scheduleNotify === undefined
          ? {}
          : { scheduleNotify: options.scheduleNotify }),
      })
    ),
    sessionHandles,
    outboundLive: bufferOutbound ? createOutboundLiveBuffer() : null,
    connected: false,
    revokePromise: null,
    disposePush: null,
    refreshTopics: null,
    pushPubSub: null,
    disposeExternalDbChanged,
  };
  stateRef.current = state;
  return state;
}

function flushOutboundLive(state: LocalEngineState): void {
  const pubsub = state.pushPubSub;
  const buf = state.outboundLive;
  if (pubsub === null || buf === null) return;
  void buf.flush(pubsub).catch((error) => handleError(state, error));
}

function detachPush(state: LocalEngineState): void {
  state.disposePush?.();
  state.disposePush = null;
  state.refreshTopics = null;
  state.pushPubSub = null;
}

function notifyLocalMutation(
  state: LocalEngineState,
  mutation: Mutation<unknown>,
  _args: unknown,
  capture: WriteCaptureSnapshot
): void {
  // A checked write belongs only to its author until the server accepts it.
  if (mutation.pendingUx === 'pending') return;
  const push = state.options.push;
  if (push === undefined || push.rowImageFanout !== true) return;
  const topicMap = withFrameworkTopicMap(push.topicMap);
  const fanoutArgs = {
    db: state.options.db,
    env: state.options.getMutationEnv(),
    capture,
    ...(topicMap !== undefined ? { topicMap } : {}),
  };
  const pubsub = state.pushPubSub;
  if (pubsub !== null && pubsub.status() === 'connected') {
    void publishOptimisticFanout({ pubsub, ...fanoutArgs }).catch((error) =>
      handleError(state, error)
    );
    return;
  }
  if (state.outboundLive === null) return;
  void buildOptimisticFanout(fanoutArgs)
    .then((items) => {
      if (items.length === 0) return;
      state.outboundLive?.enqueue(items);
      flushOutboundLive(state);
    })
    .catch((error) => handleError(state, error));
}

/** A restarted device remembers when the server last answered it. */
async function seedLastSyncedAt(state: LocalEngineState): Promise<void> {
  const stored = await readLastSyncedAtMs(state.options.db).catch(() => null);
  if (stored === null) return;
  const known = state.status.status.getSnapshot().lastSyncedAtMs;
  if (known !== null && known >= stored) return;
  state.status.patch({ lastSyncedAtMs: stored });
}

async function connectState(state: LocalEngineState): Promise<void> {
  if (state.connected) {
    state.uploadQueue.wake();
    // Identity may have switched while this engine stayed open (product-harness
    // fixed DB name). Remake entryChannel topics before waking queries.
    state.refreshTopics?.();
    state.runtime.wakeAll();
    return;
  }
  state.connected = true;
  state.status.patch({
    connection: 'connecting',
    online: true,
    lastError: null,
  });
  await seedLastSyncedAt(state);
  if (state.options.enableMutationUpload !== false) {
    state.uploadQueue.start();
  }
  state.runtime.start();
  await attachPushIfConfigured(state, () => mergeDeps(state));
  state.status.patch({ connection: 'syncing' });
}

async function drainMutationClients(state: LocalEngineState): Promise<void> {
  await Promise.all([...state.mutationDrains].map((drain) => drain()));
}

async function disconnectState(state: LocalEngineState): Promise<void> {
  state.connected = false;
  detachPush(state);
  // Local mutations outlive their component tree (bootstrap effects), so their
  // apply must finish before callers close the SqlClient (pool releaseAll).
  await drainMutationClients(state);
  // Drain in-flight sweep/merge before callers close SqlClient (pool releaseAll).
  await state.runtime.stopAndDrain();
  await state.uploadQueue.stop();
  state.status.patch({ connection: 'disconnected', hasSynced: false });
}

async function revokeDatabase(state: LocalEngineState): Promise<void> {
  state.connected = false;
  state.disposeExternalDbChanged?.();
  state.disposeExternalDbChanged = null;
  detachPush(state);
  await drainMutationClients(state);
  await state.runtime.stopAndDrain();
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
  try {
    await clearLocalCache(state.options.db, state.options.localSchema);
  } catch (error) {
    // Revoke / dispose already closed the handle — cache is gone.
    if (isSqliteClosedError(error)) return;
    throw error;
  }
  state.runtime.reset();
  state.bus.emit([
    ...state.options.localSchema.cacheTableNames,
    'sync_engine_scope_meta',
    'sync_engine_write_rejections',
  ]);
  await reapplyPendingAfterWipe(mergeDeps(state));
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
    mutationOutcome: (mutationId) =>
      mutationStatus(state.options.db, mutationId),
    listRejections: () =>
      listUnackedWriteRejections(state.options.db, state.options.getClientId()),
    pendingMutationCount: () =>
      pendingMutationCount(state.options.db, state.options.getClientId()),
    wakeUploads: () => state.uploadQueue.wake(),
    notifyLocalMutation: (mutation, args, capture) =>
      notifyLocalMutation(state, mutation, args, capture),
    registerMutationDrain: (drain) => {
      state.mutationDrains.add(drain);
      return () => {
        state.mutationDrains.delete(drain);
      };
    },
    ensurePush: () => {
      if (!state.connected) return;
      void attachPushIfConfigured(state, () => mergeDeps(state)).catch(
        (error) => handleError(state, error)
      );
    },
  };
}

/** Creates the migrated web-SQLite-backed local sync engine. */
export async function createLocalSyncEngine(
  options: CreateLocalSyncEngineOptions
): Promise<SyncEngine> {
  const merged: CreateLocalSyncEngineOptions = {
    ...options,
    mutationRegistry: withFrameworkMutations(options.mutationRegistry),
  };
  const wiped = await migrateLocalSchema(merged.db, merged.localSchema, {
    ...(merged.schemaEpoch !== undefined
      ? { schemaEpoch: merged.schemaEpoch }
      : {}),
    ...(merged.onLocalMigratePhase !== undefined
      ? { onLocalMigratePhase: merged.onLocalMigratePhase }
      : {}),
  });
  const state = createState(merged);
  if (wiped) await reapplyPendingAfterWipe(mergeDeps(state));
  return toEngine(state);
}
