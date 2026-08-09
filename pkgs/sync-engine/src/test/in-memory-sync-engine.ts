import { Database } from 'bun:sqlite';

import { SqliteSchemaDatabaseMigration } from '@pkgs/db-schema/sqlite';
import { wallIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { raw, type Sql, sql } from '@pkgs/sql';
import { assertSqlIdentifier } from '@pkgs/sql/assert-sql-identifier';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

const domainMigrateIo = wallIo();
const domainMigrateLogger = createLogger({
  name: 'in-memory-sync-engine',
  level: 'silent',
  now: domainMigrateIo.clock.now,
});

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import {
  createSharedWatchRegistry,
  type WatchSqlHandle,
} from '../client/shared-watch-registry';
import { createSubscribeQueries } from '../client/subscribe-queries';
import type { SyncEngine } from '../client/sync-engine-port';
import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
  type SyncStatusSubscription,
} from '../client/sync-status';

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

async function migrateTables(
  db: SqlClient,
  schema: LocalDomainSchema
): Promise<void> {
  await new SqliteSchemaDatabaseMigration(schema.domainSchema, {
    ownership: 'declared-only',
  }).migrate({ sqlClient: db, logger: domainMigrateLogger });
}

/**
 * Event-driven watchSql for the in-memory engine: refreshes on write
 * notifications, never polls.
 */
function createEventDrivenWatchSql(
  db: SqlClient,
  query: Sql<Record<string, unknown>>,
  onWrite: (refresh: () => void) => () => void
): WatchSqlHandle {
  let snapshot: readonly Record<string, unknown>[] = [];
  let hydrated = false;
  const listeners = new Set<() => void>();

  const refresh = (): void => {
    void db.query(query).then((rows) => {
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
    query: (query) => db.query(query),
    prepare: (query) => db.prepare(query),
    run: async (query) => {
      const result = await db.run(query);
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
  readonly schema: LocalDomainSchema;
};

function createImmediateQuerySubscription(): SyncEngine['subscribeQuery'] {
  return () => ({
    unsubscribe: () => undefined,
    waitForFirstSync: () => Promise.resolve(),
  });
}

export async function createInMemorySyncEngine(
  options: InMemorySyncEngineOptions
): Promise<SyncEngine> {
  const sqliteDb = new Database(':memory:');
  const rawDb = new SqlClientImplBunSqlite(sqliteDb);
  await migrateTables(rawDb, options.schema);
  const { status, setStatus, resetEverSynced } = createStatusStore();

  const writeListeners = new Set<() => void>();
  const notifyWrites = (): void => {
    for (const listener of writeListeners) {
      listener();
    }
  };
  const db = wrapSqlClientWithWriteNotify(rawDb, notifyWrites);

  const watchRegistry = createSharedWatchRegistry((query) =>
    createEventDrivenWatchSql(db, query, (refresh) => {
      writeListeners.add(refresh);
      return () => {
        writeListeners.delete(refresh);
      };
    })
  );

  return {
    db,
    watch: <T extends Record<string, unknown>>(query: Sql<T>) =>
      watchRegistry.watch(query),
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
      for (const name of options.schema.cacheTableNames) {
        assertSqlIdentifier(name, 'Invalid sync table name', { name });
        await db.run(sql<void>`DELETE FROM ${raw(name)}`);
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
    refreshQueries: async () => undefined,
    subscribeQuery: createImmediateQuerySubscription(),
    subscribeQueries: createSubscribeQueries(
      createImmediateQuerySubscription()
    ),
    status,
    mutationOutcome: async () => 'confirmed',
    listRejections: async () => [],
    pendingMutationCount: async () => 0,
    wakeUploads: () => undefined,
    notifyLocalMutation: () => undefined,
  };
}
