// @io-wall-ok
/**
 * Dedicated-worker entry: hosts `@sqlite.org/sqlite-wasm` for exactly one owner
 * tab. Spawned via `spawn-sqlite-worker.ts`; the owner terminates it to drop
 * every OPFS handle.
 */

import {
  isOpfsSahPoolSupported,
  OpfsSahPoolBackend,
} from '@pkgs/sql-client-sqlite-web-client/opfs-sah-pool-backend';
import { createMemorySqliteWorkerBackend } from '@pkgs/sql-client-sqlite-web-shared/memory-backend';
import type { Sqlite3Static } from '@pkgs/sql-client-sqlite-web-shared/oo1-sql-client';
import type { SqliteWorkerPort } from '@pkgs/sql-client-sqlite-web-shared/protocol';
import type { SqliteWorkerBackend } from '@pkgs/sql-client-sqlite-web-shared/sqlite-worker-host';
import {
  attachSqliteWorkerHost,
  createSqliteWorkerHost,
} from '@pkgs/sql-client-sqlite-web-shared/sqlite-worker-host';
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

async function main(): Promise<void> {
  const port = globalThis as unknown as SqliteWorkerPort;
  // Requests may arrive while the wasm module loads; buffer and replay them.
  const early: MessageEvent[] = [];
  port.onmessage = (event) => {
    early.push(event);
  };
  const sqlite3 = await sqlite3InitModule();
  attachSqliteWorkerHost(port, createSqliteWorkerHost(pickBackend(sqlite3)));
  for (const event of early) port.onmessage?.(event);
}

void main();
