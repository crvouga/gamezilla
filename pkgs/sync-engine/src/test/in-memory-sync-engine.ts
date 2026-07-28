import { Database } from 'bun:sqlite';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SyncEngine } from '../client/sync-engine-port';
import {
  createSharedWatchRegistry,
  type WatchSqlHandle,
} from '../client/shared-watch-registry';
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

/**
 * Event-driven watchSql for the in-memory engine: refreshes on write
 * notifications, never polls.
 */
function createEventDrivenWatchSql(
  db: SqlClient,
  sql: string,
  params: readonly unknown[],
  onWrite: (refresh: () => void) => () => void
): WatchSqlHandle {
  let snapshot: readonly Record<string, unknown>[] = [];
  let hydrated = false;
  const listeners = new Set<() => void>();

  const refresh = (): void => {
    void db.query<Record<string, unknown>>(sql, [...params]).then((rows) => {
      snapshot = rows;
      hydrated = true;
      for (const listener of listeners) {
        listener();
      }
    });
  };

  refresh();
  const disposeWrite = onWrite(refresh);

  return {
    getSnapshot: () => snapshot,
    getHydrated: () => hydrated,
    subscribe: (listener) => {
      listeners.add(listener);
      if (hydrated) {
        listener();
      }
      return () => {
        listeners.delete(listener);
      };
    },
    close: () => {
      disposeWrite();
      listeners.clear();
    },
  };
}

function wrapSqlClientWithWriteNotify(
  db: SqlClient,
  notify: () => void
): SqlClient {
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (sql, params) => db.query(sql, params),
    prepare: (sql) => db.prepare(sql),
    run: async (sql, params) => {
      const result = await db.run(sql, params);
      notify();
      return result;
    },
    transaction: async (fn) => {
      const result = await db.transaction(async (tx) => fn(tx));
      notify();
      return result;
    },
  };
}

export type InMemorySyncEngineOptions = {
  readonly registry: TableRegistry;
};

function createImmediateSyncStream(): NonNullable<
  SyncEngine['subscribeSyncStream']
> {
  return async () => ({
    unsubscribe: () => undefined,
    waitForFirstSync: async () => undefined,
  });
}

export function createInMemorySyncEngine(
  options: InMemorySyncEngineOptions
): SyncEngine {
  const sqlite = new Database(':memory:');
  migrateTables(sqlite, options.registry);
  const rawDb = new SqlClientImplBunSqlite(sqlite);
  const { status, setStatus, resetEverSynced } = createStatusStore();

  const writeListeners = new Set<() => void>();
  const notifyWrites = (): void => {
    for (const listener of writeListeners) {
      listener();
    }
  };
  const db = wrapSqlClientWithWriteNotify(rawDb, notifyWrites);

  const watchRegistry = createSharedWatchRegistry((sql, params) =>
    createEventDrivenWatchSql(db, sql, params, (refresh) => {
      writeListeners.add(refresh);
      return () => {
        writeListeners.delete(refresh);
      };
    })
  );

  return {
    db,
    watch: <T extends Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = []
    ) => watchRegistry.watch<T>(sql, params),
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
    subscribeSyncStream: createImmediateSyncStream(),
    status,
  };
}
