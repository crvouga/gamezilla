// @io-wall-ok
/**
 * Dedicated-worker entry: hosts `@sqlite.org/sqlite-wasm` for exactly one owner
 * tab. Spawned via `spawn-sqlite-worker.ts`; the owner terminates it to drop
 * every OPFS handle.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { createMemorySqliteWorkerBackend } from './memory-backend';
import type { Sqlite3Static } from './oo1-sql-client';
import {
  isOpfsSahPoolSupported,
  OpfsSahPoolBackend,
} from './opfs-sah-pool-backend';
import type { SqliteWorkerPort } from './protocol';
import {
  attachSqliteWorkerHost,
  createSqliteWorkerHost,
  type SqliteWorkerBackend,
} from './sqlite-worker-host';

function pickBackend(sqlite3: Sqlite3Static): SqliteWorkerBackend {
  if (new URL(globalThis.location.href).searchParams.has('memory')) {
    return createMemorySqliteWorkerBackend(sqlite3);
  }
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
