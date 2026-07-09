import type { ConfigService } from '@libs/auth/client/config-service-types';
import { createPowerSyncConnector } from '@pkgs/sync-engine-powersync/client/create-connector';
import { createPowerSyncSyncEngine } from '@pkgs/sync-engine-powersync/client/create-powersync-sync-engine';
import type { PowerSyncDatabasePort } from '@pkgs/sync-engine-powersync/client/powersync-database-port';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';

import { getPowerSyncUrl } from '../config/powersync-url';
import { createPowerSyncDatabase } from './create-power-sync-database';
import { fetchSyncToken, uploadSyncBatch, type SyncApiFetch } from './sync-api';

export type CreateAppPowerSyncSyncEngineArgs = {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
};

function toDatabasePort(
  database: ReturnType<typeof createPowerSyncDatabase>,
  connector: ReturnType<typeof createPowerSyncConnector>
): PowerSyncDatabasePort {
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
  };
}

/**
 * App-level PowerSync shell: opens the local DB, wires upload/token API calls,
 * and exposes the {@link SyncEngine} port used by auth hooks and UI.
 */
export function createAppPowerSyncSyncEngine(
  args: CreateAppPowerSyncSyncEngineArgs
): SyncEngine {
  const database = createPowerSyncDatabase();
  const connector = createPowerSyncConnector({
    powersyncUrl: getPowerSyncUrl(),
    fetchSyncToken: () =>
      fetchSyncToken({ config: args.config, fetchFn: args.fetchFn }),
    uploadBatch: (batch) =>
      uploadSyncBatch({ config: args.config, fetchFn: args.fetchFn, batch }),
  });
  return createPowerSyncSyncEngine({
    database: toDatabasePort(database, connector),
  });
}
