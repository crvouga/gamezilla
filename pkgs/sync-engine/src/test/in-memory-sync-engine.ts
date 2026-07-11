import { Database } from 'bun:sqlite';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SyncEngine, WatchSubscription } from '../client/sync-engine-port';
import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
  type SyncStatusSubscription,
} from '../client/sync-status';
import type { TableRegistry } from '../shared/table-registry';

function createStatusStore(): {
  readonly status: SyncStatusSubscription;
  setStatus: (next: Omit<SyncEngineStatus, 'hasEverSynced'>) => void;
  resetEverSynced: () => void;
} {
  let status: SyncEngineStatus = { ...INITIAL_SYNC_STATUS };
  let hasEverSynced = false;
  const listeners = new Set<(s: SyncEngineStatus) => void>();

  const publish = (next: Omit<SyncEngineStatus, 'hasEverSynced'>): void => {
    if (next.hasSynced) {
      hasEverSynced = true;
    }
    status = { ...next, hasEverSynced };
    for (const listener of listeners) {
      listener(status);
    }
  };

  return {
    status: {
      getSnapshot: () => status,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setStatus: publish,
    resetEverSynced: () => {
      hasEverSynced = false;
    },
  };
}

function migrateTables(db: Database, registry: TableRegistry): void {
  for (const name of registry.tableNames()) {
    const def = registry.get(name);
    if (def === undefined) continue;
    const cols = def.columns
      .map((c) => {
        const pk = c.primaryKey === true ? ' PRIMARY KEY' : '';
        return `${c.name} ${c.type.toUpperCase()}${pk}`;
      })
      .join(', ');
    db.run(`CREATE TABLE IF NOT EXISTS ${def.tableName} (${cols})`);
  }
}

function createWatch<T extends Record<string, unknown>>(
  db: SqlClient,
  sql: string,
  params: readonly unknown[],
  bump: () => void
): WatchSubscription<readonly T[]> {
  let snapshot: readonly T[] = [];
  let hydrated = false;

  const refresh = async (): Promise<void> => {
    snapshot = await db.query<T>(sql, [...params]);
    hydrated = true;
    bump();
  };

  void refresh();

  return {
    getSnapshot: () => snapshot,
    getHydrated: () => hydrated,
    subscribe: (listener) => {
      void refresh().then(() => listener());
      const interval = setInterval(() => {
        void refresh();
      }, 100);
      return () => clearInterval(interval);
    },
  };
}

export type InMemorySyncEngineOptions = {
  readonly registry: TableRegistry;
};

export function createInMemorySyncEngine(
  options: InMemorySyncEngineOptions
): SyncEngine {
  const sqlite = new Database(':memory:');
  migrateTables(sqlite, options.registry);
  const db = new SqlClientImplBunSqlite(sqlite);
  const { status, setStatus, resetEverSynced } = createStatusStore();

  return {
    db,
    watch: <T extends Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = []
    ) => createWatch<T>(db, sql, params, () => undefined),
    connect: async () => {
      await db.connect();
      setStatus({
        connection: 'connected',
        online: true,
        hasSynced: true,
        lastError: null,
      });
    },
    disconnect: async () => {
      await db.disconnect();
      setStatus({
        ...INITIAL_SYNC_STATUS,
        connection: 'disconnected',
      });
    },
    clearLocalData: async () => {
      for (const name of options.registry.tableNames()) {
        await db.run(`DELETE FROM ${name}`);
      }
      resetEverSynced();
      setStatus({
        connection: 'connected',
        online: true,
        hasSynced: false,
        lastError: null,
      });
    },
    waitForFirstSync: async () => {
      setStatus({
        connection: 'connected',
        online: true,
        hasSynced: true,
        lastError: null,
      });
    },
    status,
  };
}
