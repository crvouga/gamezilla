import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
} from '@pkgs/sync-engine/client/sync-status';
import type { SyncEngine, WatchSubscription } from '@pkgs/sync-engine/client/sync-engine-port';
import type { SyncStreamSubscription } from '@pkgs/sync-engine/client/sync-stream-subscription';

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

function createWatch<T extends Record<string, unknown>>(
  db: PowerSyncDatabasePort,
  sql: string,
  params: readonly unknown[]
): WatchSubscription<readonly T[]> {
  let snapshot: readonly T[] = [];
  let hydrated = false;

  const refresh = async (): Promise<void> => {
    snapshot = await db.getAll<T>(sql, [...params]);
    hydrated = true;
  };

  void refresh();

  return {
    getSnapshot: () => snapshot,
    getHydrated: () => hydrated,
    subscribe: (listener) => {
      void refresh().then(() => listener());
      const unregister = db.registerListener({
        statusChanged: () => {
          void refresh().then(() => listener());
        },
      });
      const interval = setInterval(() => {
        void refresh().then(() => listener());
      }, 500);
      return () => {
        unregister();
        clearInterval(interval);
      };
    },
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
    parameters: Readonly<Record<string, string | number>>
  ): Promise<SyncStreamSubscription> => {
    const handle = db.syncStream!(streamName, parameters);
    const subscription = await handle.subscribe({ priority: 3 });
    return {
      unsubscribe: () => subscription.unsubscribe(),
      waitForFirstSync: () => subscription.waitForFirstSync(),
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
  let status: SyncEngineStatus = { ...INITIAL_SYNC_STATUS };
  let hasEverSynced = everSyncedLatch?.read() ?? false;
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

  const subscribeSyncStream = createSubscribeSyncStream(db);

  return {
    db: sqlClient,
    watch: <T extends Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = []
    ) => createWatch<T>(db, sql, params),
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
