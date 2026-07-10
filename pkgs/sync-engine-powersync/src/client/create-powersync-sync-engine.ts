import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
} from '@pkgs/sync-engine/client/sync-status';
import type { SyncEngine, WatchSubscription } from '@pkgs/sync-engine/client/sync-engine-port';
import type { SyncStreamSubscription } from '@pkgs/sync-engine/client/sync-stream-subscription';

import type { PowerSyncDatabasePort } from './powersync-database-port';
import { createSqlClientFromPowerSync } from './sql-client-facade';

function mapStatus(db: PowerSyncDatabasePort): SyncEngineStatus {
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

export type CreatePowerSyncSyncEngineOptions = {
  readonly database: PowerSyncDatabasePort;
};

export function createPowerSyncSyncEngine(
  options: CreatePowerSyncSyncEngineOptions
): SyncEngine {
  const db = options.database;
  const sqlClient = createSqlClientFromPowerSync(db);
  let status: SyncEngineStatus = { ...INITIAL_SYNC_STATUS };
  const listeners = new Set<(s: SyncEngineStatus) => void>();

  const publishStatus = (): void => {
    status = mapStatus(db);
    for (const listener of listeners) {
      listener(status);
    }
  };

  db.registerListener({ statusChanged: publishStatus });

  const subscribeSyncStream =
    db.syncStream === undefined
      ? undefined
      : async (
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
