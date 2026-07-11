import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { Kv } from '@pkgs/kv/interface';
import { createPowerSyncConnector } from '@pkgs/sync-engine-powersync/client/create-connector';
import { createPowerSyncSyncEngine } from '@pkgs/sync-engine-powersync/client/create-powersync-sync-engine';
import type { PowerSyncDatabasePort } from '@pkgs/sync-engine-powersync/client/powersync-database-port';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';

import { getPowerSyncUrl } from '../config/powersync-url';
import { getMainSqliteDbName } from '../storage/open-main-sql-client';
import { createPowerSyncDatabase } from './create-power-sync-database';
import {
  createKvEverSyncedLatch,
  readEverSyncedFromKv,
  readMemoryEverSynced,
} from './sync-ever-synced-cache';
import { fetchSyncToken, uploadSyncBatch, type SyncApiFetch } from './sync-api';

export type CreateAppPowerSyncSyncEngineArgs = {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly kv: Kv;
};

function toDatabasePort(
  database: ReturnType<typeof createPowerSyncDatabase>,
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
        fn(tx as unknown as PowerSyncDatabasePort)
      ),
    registerListener: (listener) => database.registerListener(listener),
    get currentStatus() {
      return database.currentStatus;
    },
    ...(syncStream !== undefined ? { syncStream } : {}),
  };
}

type GlobalSyncEngineCache = Map<string, SyncEngine>;

function getSyncEngineCache(): GlobalSyncEngineCache {
  const g = globalThis as typeof globalThis & {
    __gamezillaSyncEngines?: GlobalSyncEngineCache;
  };
  if (g.__gamezillaSyncEngines === undefined) {
    g.__gamezillaSyncEngines = new Map();
  }
  return g.__gamezillaSyncEngines;
}

/**
 * App-level PowerSync shell: opens the local DB, wires upload/token API calls,
 * and exposes the {@link SyncEngine} port used by auth hooks and UI.
 */
export async function createAppPowerSyncSyncEngine(
  args: CreateAppPowerSyncSyncEngineArgs
): Promise<SyncEngine> {
  const sessionKey = getMainSqliteDbName();
  const cached = getSyncEngineCache().get(sessionKey);
  if (cached !== undefined) {
    return cached;
  }
  const initialEverSynced =
    (await readEverSyncedFromKv({
      kv: args.kv,
      sessionKey,
    })) || readMemoryEverSynced(sessionKey);
  const database = createPowerSyncDatabase();
  const connector = createPowerSyncConnector({
    powersyncUrl: getPowerSyncUrl(),
    fetchSyncToken: () =>
      fetchSyncToken({
        config: args.config,
        fetchFn: args.fetchFn,
        kv: args.kv,
      }),
    uploadBatch: async (batch) => {
      await uploadSyncBatch({ config: args.config, fetchFn: args.fetchFn, batch });
    },
  });
  const engine = createPowerSyncSyncEngine({
    database: toDatabasePort(database, connector),
    everSyncedLatch: createKvEverSyncedLatch({
      kv: args.kv,
      sessionKey,
      initial: initialEverSynced,
    }),
  });
  getSyncEngineCache().set(sessionKey, engine);
  return engine;
}
