// @io-wall-ok
/**
 * Dedicated-worker entry: hosts `@sqlite.org/sqlite-wasm` for exactly one owner
 * tab. Spawned via `spawn-sqlite-worker.ts`; the owner terminates it to drop
 * every OPFS handle.
 */

import {
  isOpfsSahPoolSupported,
  OpfsSahPoolBackend,
} from '@pkgs/sql-client-sqlite-web-client-ts/opfs-sah-pool-backend';
import { createMemorySqliteWorkerBackend } from '@pkgs/sql-client-sqlite-web-shared-ts/memory-backend';
import type { Sqlite3Static } from '@pkgs/sql-client-sqlite-web-shared-ts/oo1-sql-client';
import type { SqliteWorkerPort } from '@pkgs/sql-client-sqlite-web-shared-ts/protocol';
import type { SqliteWorkerBackend } from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-host';
import { createSqliteWorkerHost } from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-host';
import { attachInitializingSqliteWorkerHost } from '@pkgs/sql-client-sqlite-web-shared-ts/sqlite-worker-startup';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

function pickBackend(sqlite3: Sqlite3Static): SqliteWorkerBackend {
  if (isOpfsSahPoolSupported()) {
    return new OpfsSahPoolBackend(sqlite3);
  }
  console.warn(
    '[sqlite-worker] OPFS sync access handles unavailable; using memory database'
  );
  return createMemorySqliteWorkerBackend(sqlite3);
}

attachInitializingSqliteWorkerHost(
  globalThis as unknown as SqliteWorkerPort,
  async () => {
    const sqlite3 = await sqlite3InitModule();
    return createSqliteWorkerHost(pickBackend(sqlite3));
  }
);
