// @io-wall-ok — Bun report server entry: open native sqlite dumps via bun:sqlite.
/**
 * Convert a better-sqlite3 / DST `serialize()` image into sqlite-mem SQLM bytes.
 * Only import from Bun process entries (local report servers) — not Workers.
 */

import { Database } from 'bun:sqlite';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';

import { sqliteClientToSqlmBytes } from './sqlite-client-to-sqlm';

export async function bunSqliteDumpToSqlm(
  bytes: Uint8Array,
  nowMs: number
): Promise<Uint8Array> {
  if (bytes.byteLength === 0) {
    throw new Error('bunSqliteDumpToSqlm: empty sqlite image');
  }
  const db = Database.deserialize(bytes, { readonly: true });
  try {
    const client = new SqlClientImplBunSqlite(db);
    return await sqliteClientToSqlmBytes(client, nowMs);
  } finally {
    db.close(false);
  }
}
