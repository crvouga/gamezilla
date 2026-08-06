import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { Kv } from '@pkgs/kv/interface';
import { createPowerSyncConnector } from '@pkgs/sync-engine-powersync/client/create-connector';
import { createPowerSyncSyncEngine } from '@pkgs/sync-engine-powersync/client/create-powersync-sync-engine';
import type {
  PowerSyncDatabasePort,
  PowerSyncWatchSqlHandle,
} from '@pkgs/sync-engine-powersync/client/powersync-database-port';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';

import { getPowerSyncUrl } from '../config/powersync-url';
import {
  openPowerSyncDatabase,
  type PowerSyncSdkDatabase,
} from './create-power-sync-database';
import {
  createKvEverSyncedLatch,
  readEverSyncedFromKv,
  readMemoryEverSynced,
} from './sync-ever-synced-cache';
import {
  fetchSyncToken,
  uploadSyncBatch,
  type GetFreshAuthToken,
  type SyncApiFetch,
  type SyncClientAuth,
} from './sync-api';

export type CreateAppPowerSyncSyncEngineArgs = {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly kv: Kv;
  /** Identity-scoped SQLite name; must match the boot cache key. */
  readonly databaseName: string;
  /**
   * Live session refresh for `/api/sync/token` + upload. Must not close over a
   * stale React callback — pass a getter that reads the latest port method.
   */
  readonly getFreshAuthToken: GetFreshAuthToken;
  /** Live identity/token getters from React hooks (via refs). */
  readonly auth: SyncClientAuth;
};

/**
 * Native PowerSync differential watch — table-change driven, stable row refs.
 * No polling.
 */
function createWatchSqlFromSdk(
  database: PowerSyncSdkDatabase,
  sql: string,
  params: readonly unknown[]
): PowerSyncWatchSqlHandle {
  const watched = database
    .query({
      sql,
      parameters: [...params] as (
        | string
        | number
        | boolean
        | null
        | undefined
      )[],
    })
    .differentialWatch();

  let snapshot: readonly Record<string, unknown>[] = Array.isArray(
    watched.state.data
  )
    ? (watched.state.data as readonly Record<string, unknown>[])
    : [];
  let hydrated = !watched.state.isLoading;

  const dispose = watched.registerListener({
    onStateChange: (state) => {
      snapshot = Array.isArray(state.data)
        ? (state.data as readonly Record<string, unknown>[])
        : [];
      if (!state.isLoading) {
        hydrated = true;
      }
    },
    onData: (data) => {
      snapshot = data as readonly Record<string, unknown>[];
      hydrated = true;
    },
  });

  return {
    getSnapshot: () => snapshot,
    getHydrated: () => hydrated,
    subscribe: (listener) => {
      const unsub = watched.registerListener({
        onStateChange: () => listener(),
        onData: () => listener(),
      });
      // Do not call listener() synchronously — violates useSyncExternalStore
      // (React already reads getSnapshot after subscribe).
      return unsub;
    },
    close: () => {
      dispose();
      void watched.close();
    },
  };
}

function unsupportedWatchSql<T extends Record<string, unknown>>(
  _sql?: string,
  _params?: readonly unknown[]
): PowerSyncWatchSqlHandle<T> {
  throw new Error('watchSql is not available inside a write transaction');
}

function unsupportedTxLifecycle(): Promise<never> {
  return Promise.reject(
    new Error('connect/disconnect is not available inside a write transaction')
  );
}

/**
 * PowerSync transaction methods live on the prototype — object spread drops
 * them and yields `db.execute is not a function` inside writeTransaction.
 */
function toWriteTransactionPort(
  database: PowerSyncSdkDatabase,
  tx: unknown
): PowerSyncDatabasePort {
  const locked = tx as Pick<PowerSyncSdkDatabase, 'getAll' | 'execute'>;
  if (
    typeof locked.execute !== 'function' ||
    typeof locked.getAll !== 'function'
  ) {
    throw new Error(
      `PowerSync write tx missing execute/getAll (execute=${typeof locked.execute}, getAll=${typeof locked.getAll})`
    );
  }
  const execute = locked.execute.bind(locked);
  const getAll = locked.getAll.bind(locked);
  const port: PowerSyncDatabasePort = {
    connect: unsupportedTxLifecycle,
    disconnect: unsupportedTxLifecycle,
    disconnectAndClear: unsupportedTxLifecycle,
    waitForFirstSync: unsupportedTxLifecycle,
    getAll,
    execute,
    writeTransaction: (fn) => fn(port),
    registerListener: () => () => undefined,
    watchSql: unsupportedWatchSql,
    get currentStatus() {
      return database.currentStatus;
    },
  };
  return port;
}

function toDatabasePort(
  database: PowerSyncSdkDatabase,
  connector: ReturnType<typeof createPowerSyncConnector>
): PowerSyncDatabasePort {
  const syncStream =
    typeof database.syncStream === 'function'
      ? (
          streamName: string,
          parameters: Readonly<Record<string, string | number>>
        ) => database.syncStream!(streamName, parameters)
      : undefined;

  return {
    connect: () => database.connect(connector),
    disconnect: () => database.disconnect(),
    disconnectAndClear: () => database.disconnectAndClear(),
    waitForFirstSync: () => database.waitForFirstSync(),
    getAll: (sql, params) => database.getAll(sql, params),
    execute: (sql, params) => database.execute(sql, params),
    writeTransaction: (fn) =>
      database.writeTransaction(async (tx) =>
        fn(toWriteTransactionPort(database, tx))
      ),
    registerListener: (listener) => database.registerListener(listener),
    watchSql: <T extends Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = []
    ) =>
      createWatchSqlFromSdk(
        database,
        sql,
        params
      ) as PowerSyncWatchSqlHandle<T>,
    get currentStatus() {
      return database.currentStatus;
    },
    ...(syncStream !== undefined ? { syncStream } : {}),
  };
}

/**
 * App-level PowerSync shell: opens the local DB, wires upload/token API calls,
 * and exposes the {@link SyncEngine} port used by auth hooks and UI.
 *
 * Prefer {@link getOrCreateAppPowerSyncSyncEngine} so warm identities reuse the
 * same wrapper after {@link openPowerSyncDatabase} reactivates the pooled file.
 */
export async function createAppPowerSyncSyncEngine(
  args: CreateAppPowerSyncSyncEngineArgs
): Promise<SyncEngine> {
  const sessionKey = args.databaseName;
  const database = await openPowerSyncDatabase(sessionKey);
  const initialEverSynced =
    (await readEverSyncedFromKv({
      kv: args.kv,
      sessionKey,
    })) || readMemoryEverSynced(sessionKey);
  const connector = createPowerSyncConnector({
    powersyncUrl: getPowerSyncUrl(),
    fetchSyncToken: () =>
      fetchSyncToken({
        config: args.config,
        fetchFn: args.fetchFn,
        kv: args.kv,
        auth: args.auth,
        getFreshAuthToken: args.getFreshAuthToken,
      }),
    uploadBatch: async (batch) => {
      await uploadSyncBatch({
        config: args.config,
        fetchFn: args.fetchFn,
        batch,
        auth: args.auth,
        getFreshAuthToken: args.getFreshAuthToken,
      });
    },
  });
  return createPowerSyncSyncEngine({
    database: toDatabasePort(database, connector),
    everSyncedLatch: createKvEverSyncedLatch({
      kv: args.kv,
      sessionKey,
      initial: initialEverSynced,
    }),
  });
}
