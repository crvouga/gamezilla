// @io-wall-ok

import { Database } from 'bun:sqlite';

import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import { assertSqlIdentifier } from '@pkgs/sql-root-shared/assert-sql-identifier';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import sql, { raw } from '@pkgs/sql-root-shared/sql';

import type { LocalDomainSchema } from '@pkgs/sync-engine-client/local-schema-migrate';
import type { MutationFeedback } from '@pkgs/sync-engine-client/mutation-status';
import type { WatchSqlHandle } from '@pkgs/sync-engine-client/shared-watch-registry';
import { createSharedWatchRegistry } from '@pkgs/sync-engine-client/shared-watch-registry';
import { createSubscribeQueries } from '@pkgs/sync-engine-client/subscribe-queries';
import type { SyncEngine } from '@pkgs/sync-engine-client/sync-engine-port';
import type {
  SyncEngineStatus,
  SyncStatusSubscription,
} from '@pkgs/sync-engine-client/sync-status';
import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client/sync-status';
import type { WriteRefusal } from '@pkgs/sync-engine-client/write-outcome-reads';

function createStatusStore(): {
  readonly status: SyncStatusSubscription;
  setStatus: (
    next: Omit<SyncEngineStatus, 'hasEverSynced' | 'lastSyncedAtMs'>
  ) => void;
  resetEverSynced: () => void;
} {
  let status: SyncEngineStatus = { ...INITIAL_SYNC_STATUS };
  let hasEverSynced = false;
  const listeners = new Set<(s: SyncEngineStatus) => void>();

  const publish = (
    next: Omit<SyncEngineStatus, 'hasEverSynced' | 'lastSyncedAtMs'>
  ): void => {
    if (next.hasSynced) {
      hasEverSynced = true;
    }
    // No server answers an in-memory engine, so nothing confirms its rows.
    status = { ...next, hasEverSynced, lastSyncedAtMs: null };
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
  await reconcileSqliteSchema(db, schema.domainSchema, {
    ownership: 'declared-only',
  });
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
        upgradeRequired: false,
      });
    },
    disconnect: async () => {
      await db.disconnect();
      setStatus({
        connection: 'disconnected',
        online: INITIAL_SYNC_STATUS.online,
        hasSynced: INITIAL_SYNC_STATUS.hasSynced,
        lastError: INITIAL_SYNC_STATUS.lastError,
        upgradeRequired: INITIAL_SYNC_STATUS.upgradeRequired,
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
        upgradeRequired: false,
      });
    },
    waitForFirstSync: async () => {
      setStatus({
        connection: 'connected',
        online: true,
        hasSynced: true,
        lastError: null,
        upgradeRequired: false,
      });
    },
    refreshQueries: async () => undefined,
    subscribeQuery: createImmediateQuerySubscription(),
    subscribeQueries: createSubscribeQueries(
      createImmediateQuerySubscription()
    ),
    status,
    mutationOutcome: async () => 'confirmed',
    // This engine applies writes immediately and has no upload queue.
    mutationFeedback: () =>
      watchRegistry.watch(
        sql<MutationFeedback>`SELECT NULL AS "mutationId" WHERE false`
      ),
    listRejections: async () => [],
    unheardRefusals: () =>
      watchRegistry.watch(
        sql<WriteRefusal>`SELECT NULL AS "mutationId" WHERE false`
      ),
    pendingMutationCount: async () => 0,
    wakeUploads: () => undefined,
    notifyLocalMutation: () => undefined,
    // Harness mutations are awaited by the harness scheduler; nothing to drain.
    registerMutationDrain: () => () => undefined,
    ensurePush: () => undefined,
  };
}
