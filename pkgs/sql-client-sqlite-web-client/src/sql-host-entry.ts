// @io-wall-ok — browser page entry for the disposable OPFS sql-host iframe

import { wallTimers } from '@pkgs/clock-shared/wall';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { spawnSqliteWorker } from '@pkgs/sql-client-sqlite-web-shared/spawn-sqlite-worker';
import type { SqliteWorkerSqlOwner } from '@pkgs/sql-client-sqlite-web-shared/sqlite-worker-sql-owner';
import { createSqliteWorkerSqlOwner } from '@pkgs/sql-client-sqlite-web-shared/sqlite-worker-sql-owner';
import type { Value } from '@pkgs/sql-shared/sql';
import { Sql } from '@pkgs/sql-shared/sql';

export type SqlHostRunResult = {
  readonly lastInsertRowId: number;
  readonly changes: number;
};

export type SqlHostApi = {
  open: (dbName: string) => Promise<void>;
  close: () => Promise<void>;
  query: (
    sql: string,
    values?: readonly unknown[]
  ) => Promise<Record<string, unknown>[]>;
  run: (sql: string, values?: readonly unknown[]) => Promise<SqlHostRunResult>;
  resetStore: () => Promise<void>;
};

function makeSql(
  statement: string,
  values: readonly unknown[]
): Sql<Record<string, unknown>> {
  return new Sql(statement.split('?'), values as Value[]);
}

/**
 * Thin iframe facade over {@link createSqliteWorkerSqlOwner}. Destroying this
 * document terminates the dedicated sqlite-wasm worker and releases every OPFS
 * SyncAccessHandle — the same recovery primitive product uses via
 * `owner.close()` / worker `terminate()`.
 */
function createSqlHost(): SqlHostApi {
  let owner: SqliteWorkerSqlOwner | null = null;
  let client: SqlClient | null = null;

  const requireClient = (): SqlClient => {
    if (client === null) throw new Error('sql-host: open() was not called');
    return client;
  };

  const close = async (): Promise<void> => {
    const live = owner;
    client = null;
    owner = null;
    if (live === null) return;
    await live.close();
  };

  return {
    open: async (dbName) => {
      await close();
      const next = createSqliteWorkerSqlOwner({
        dbName,
        timers: wallTimers,
        spawnWorker: (name) => spawnSqliteWorker(name),
      });
      owner = next;
      client = await next.open();
    },
    close,
    query: (sql, values = []) => requireClient().query(makeSql(sql, values)),
    run: async (sql, values = []) => {
      const result = await requireClient().run(makeSql(sql, values));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    resetStore: async () => {
      const live = owner;
      client = null;
      owner = null;
      if (live === null) return;
      await live.resetStore();
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __sqlHost: SqlHostApi | undefined;
}

globalThis.__sqlHost = createSqlHost();
window.parent.postMessage({ type: 'ready', source: 'sql-host' }, '*');
