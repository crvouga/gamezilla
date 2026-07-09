import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
} from '@pkgs/sync-engine/client/sync-status';
import type { SyncEngine, WatchSubscription } from '@pkgs/sync-engine/client/sync-engine-port';

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

  const refresh = async (): Promise<void> => {
    snapshot = await db.getAll<T>(sql, [...params]);
  };

  void refresh();

  return {
    getSnapshot: () => snapshot,
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
