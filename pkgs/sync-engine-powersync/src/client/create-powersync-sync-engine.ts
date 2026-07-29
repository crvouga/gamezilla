import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
} from '@pkgs/sync-engine/client/sync-status';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import { createSharedWatchRegistry } from '@pkgs/sync-engine/client/shared-watch-registry';
import type { SyncStreamSubscription } from '@pkgs/sync-engine/client/sync-stream-subscription';
import type { Sql } from '@pkgs/sql';

import type { PowerSyncDatabasePort } from './powersync-database-port';
import { createSqlClientFromPowerSync } from './sql-client-facade';

export type EverSyncedLatch = {
  readonly read: () => boolean;
  readonly latch: () => void;
  readonly reset: () => void;
};

function mapStatus(
  db: PowerSyncDatabasePort
): Omit<SyncEngineStatus, 'hasEverSynced'> {
  const s = db.currentStatus;
  let connection: SyncEngineStatus['connection'] = 'disconnected';
  if (s.connecting) connection = 'connecting';
  else if (s.connected) {
    connection =
      s.dataFlowStatus.downloading || s.dataFlowStatus.uploading
        ? 'syncing'
        : 'connected';
  }
  return {
    connection,
    online: s.connected,
    hasSynced: s.hasSynced,
    lastError: null,
  };
}

function createSubscribeSyncStream(
  db: PowerSyncDatabasePort
): SyncEngine['subscribeSyncStream'] {
  if (db.syncStream === undefined) {
    return undefined;
  }
  return async (
    streamName: string,
    parameters: Readonly<Record<string, string | number>>,
    options?: { readonly priority?: number }
  ): Promise<SyncStreamSubscription> => {
    const handle = db.syncStream!(streamName, parameters);
    const subscription = await handle.subscribe(
      options?.priority === undefined
        ? undefined
        : { priority: options.priority }
    );
    return {
      unsubscribe: () => subscription.unsubscribe(),
      waitForFirstSync: (abort) => subscription.waitForFirstSync(abort),
    };
  };
}

export type CreatePowerSyncSyncEngineOptions = {
  readonly database: PowerSyncDatabasePort;
  /** Persists hasEverSynced across sync-engine wrapper recreation (e.g. dev HMR). */
  readonly everSyncedLatch?: EverSyncedLatch;
};

export function createPowerSyncSyncEngine(
  options: CreatePowerSyncSyncEngineOptions
): SyncEngine {
  const db = options.database;
  const everSyncedLatch = options.everSyncedLatch;
  const sqlClient = createSqlClientFromPowerSync(db);
  let hasEverSynced = everSyncedLatch?.read() ?? false;
  // Seed status with the latch — INITIAL_SYNC_STATUS.hasEverSynced is false and
  // would pin empty watches on LoadingState until the first statusChanged.
  let status: SyncEngineStatus = {
    ...INITIAL_SYNC_STATUS,
    hasEverSynced,
  };
  const listeners = new Set<(s: SyncEngineStatus) => void>();

  const publishStatus = (): void => {
    const mapped = mapStatus(db);
    if (mapped.hasSynced) {
      everSyncedLatch?.latch();
    }
    hasEverSynced =
      hasEverSynced || mapped.hasSynced || (everSyncedLatch?.read() ?? false);
    status = { ...mapped, hasEverSynced };
    for (const listener of listeners) {
      listener(status);
    }
  };

  db.registerListener({ statusChanged: publishStatus });
  publishStatus();

  const subscribeSyncStream = createSubscribeSyncStream(db);
  const watchRegistry = createSharedWatchRegistry((query) =>
    db.watchSql(query.sql, query.values)
  );

  return {
    db: sqlClient,
    watch: <T extends Record<string, unknown>>(query: Sql) =>
      watchRegistry.watch<T>(query),
    connect: async () => {
      await db.connect();
      publishStatus();
    },
    disconnect: async () => {
      await db.disconnect();
      publishStatus();
    },
    clearLocalData: async () => {
      await db.disconnectAndClear();
      hasEverSynced = false;
      everSyncedLatch?.reset();
      publishStatus();
    },
    waitForFirstSync: async () => {
      await db.waitForFirstSync();
      publishStatus();
    },
    ...(subscribeSyncStream !== undefined ? { subscribeSyncStream } : {}),
    status: {
      getSnapshot: () => status,
      subscribe: (listener) => {
        listeners.add(listener);
        listener(status);
        return () => listeners.delete(listener);
      },
    },
  };
}
