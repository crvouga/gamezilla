import type { PubSub } from '@pkgs/pubsub/interface';
import type { MutationAppliedEvent } from '@pkgs/sync-engine/mutations/client/create-mutation-client';
import type {
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine/mutations/core/types';
import { createSqlWatch } from '@pkgs/sync-engine/queries/client/sql-watch';
import { createTableChangeBus } from '@pkgs/sync-engine/queries/client/table-change-bus';
import type {
  QueryRegistry,
  QueryResponse,
} from '@pkgs/sync-engine/queries/core/types';
import '@pkgs/sync-engine/queries/shared/tiger-invariants';
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { QueryChannelsCtx } from '@pkgs/sync-engine/shared/nudge-payload';

import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import type { AppLifecycle } from './app-lifecycle';
import { attachNudges } from './attach-nudges';
import {
  clearLocalCache,
  type LocalDomainSchema,
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
import { publishMutationFanout } from './publish-mutation-fanout';
import { createSharedWatchRegistry } from './shared-watch-registry';
import type { CreateId, Timers } from './sim-ports';
import { createSubscribeQueries } from './subscribe-queries';
import {
  type QueryRequest,
  type QuerySubscriptionSpec,
  SubscriptionRuntime,
} from './subscription-runtime';
import type { SyncEngine } from './sync-engine-port';
import { createTableChangeSqlClient } from './table-change-sql-client';

export type SyncEngineNudgesOptions = {
  readonly queryRegistry: QueryRegistry;
  readonly createPubSub: () => PubSub;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly onBindTopicRefresh?: (refresh: () => void) => void;
};

export type CreateLocalSyncEngineOptions = {
  readonly db: SqlClient;
  readonly localSchema: LocalDomainSchema;
  readonly mutationRegistry: MutationRegistry;
  readonly getMutationEnv: () => MutationEnv;
  readonly getClientId: () => string;
  readonly bootQueries: readonly QuerySubscriptionSpec[];
  readonly postQueries: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly postMutations: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
  readonly isAuthRevoked: (error: unknown) => boolean;
  readonly deleteDatabase: () => Promise<void>;
  /**
   * Optional pubsub nudges. When omitted the engine hydrates once at connect
   * and stays on that snapshot until reconnect — no periodic poll.
   */
  readonly nudges?: SyncEngineNudgesOptions;
  readonly lifecycle?: AppLifecycle;
  /** Virtual clock / timers / RNG for deterministic simulation. */
  readonly now?: () => number;
  readonly random?: () => number;
  readonly timers?: Timers;
  readonly createId?: CreateId;
};

type LocalEngineState = {
  readonly options: CreateLocalSyncEngineOptions;
  readonly bus: ReturnType<typeof createTableChangeBus>;
  readonly appDb: SqlClient;
  readonly status: LocalSyncStatusStore;
  readonly runtime: SubscriptionRuntime;
  readonly uploadQueue: MutationUploadQueue;
  readonly watches: ReturnType<typeof createSharedWatchRegistry>;
  connected: boolean;
  revokePromise: Promise<void> | null;
  disposeNudges: (() => void) | null;
  fanoutPubSub: PubSub | null;
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
    boot: options.bootQueries,
    postQueries: options.postQueries,
    ...(options.lifecycle !== undefined
      ? { lifecycle: options.lifecycle }
      : {}),
    ...(options.random !== undefined ? { random: options.random } : {}),
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
  const uploadQueue = new MutationUploadQueue({
    db: options.db,
    bus,
    clientId: options.getClientId,
    postBatch: options.postMutations,
    // Local rows already applied; overlapping scopes are nudged via pubsub.
    onUploaded: () => undefined,
    onError: (error) => handleError(readState(stateRef), error),
    ...(options.timers !== undefined ? { timers: options.timers } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  // Don't wait for IDLE_DELAY_MS — local mutate commits emit `_mutations`.
  bus.subscribe((tables) => {
    if (tables.has('_mutations')) uploadQueue.wake();
  });
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
    connected: false,
    revokePromise: null,
    disposeNudges: null,
    fanoutPubSub: null,
  };
  stateRef.current = state;
  return state;
}

function fanoutFromState(
  state: LocalEngineState,
  event: MutationAppliedEvent
): void {
  const pubsub = state.fanoutPubSub;
  if (pubsub === null) return;
  publishMutationFanout({
    pubsub,
    event: {
      mutationId: event.mutationId,
      mutation: event.mutation,
      args: event.args,
      seq: event.seq,
      createdAt: event.createdAt,
      env: state.options.getMutationEnv(),
      clientId: state.options.getClientId(),
    },
  });
}

function attachNudgesIfConfigured(state: LocalEngineState): void {
  const nudges = state.options.nudges;
  if (nudges === undefined || state.disposeNudges !== null) {
    return;
  }
  try {
    let pubsub = nudges.createPubSub();
    state.disposeNudges = attachNudges({
      pubsub,
      runtime: state.runtime,
      queryRegistry: nudges.queryRegistry,
      mutationRegistry: state.options.mutationRegistry,
      bus: state.bus,
      db: state.options.db,
      getChannelsCtx: nudges.getChannelsCtx,
      remakePubSub: () => {
        pubsub = nudges.createPubSub();
        return pubsub;
      },
      onPubSubInstance: (instance) => {
        state.fanoutPubSub = instance;
      },
      ...(nudges.onBindTopicRefresh !== undefined
        ? { onBindTopicRefresh: nudges.onBindTopicRefresh }
        : {}),
      ...(state.options.timers !== undefined
        ? { timers: state.options.timers }
        : {}),
      onTablesChanged: (listener) => state.bus.subscribe(listener),
    });
  } catch (error) {
    console.warn(
      '[sync] attachNudges failed; continuing without live nudges',
      error
    );
  }
}

function detachNudges(state: LocalEngineState): void {
  state.disposeNudges?.();
  state.disposeNudges = null;
  state.fanoutPubSub = null;
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
  attachNudgesIfConfigured(state);
  state.status.patch({ connection: 'syncing' });
}

async function disconnectState(state: LocalEngineState): Promise<void> {
  state.connected = false;
  detachNudges(state);
  state.runtime.stop();
  await state.uploadQueue.stop();
  state.status.patch({ connection: 'disconnected', hasSynced: false });
}

async function revokeDatabase(state: LocalEngineState): Promise<void> {
  state.connected = false;
  detachNudges(state);
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
    '_row_scopes',
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
    waitForFirstSync: () => state.runtime.waitForBoot(),
    subscribeQuery,
    subscribeQueries: createSubscribeQueries(subscribeQuery),
    status: state.status.status,
    wakeUploads: () => state.uploadQueue.wake(),
    fanoutMutation: (event) => fanoutFromState(state, event),
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
  await migrateLocalSchema(merged.db, merged.localSchema);
  return toEngine(createState(merged));
}
