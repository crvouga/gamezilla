/**
 * Copy schema + rows from any SqlClient into a sqlite-mem SQLM envelope.
 * Used by report servers that open native sqlite dumps (Bun / better-sqlite3).
 */

import { ident, join, raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';

type SchemaObject = {
  readonly name: string;
  readonly type: 'table' | 'view' | 'index';
  readonly sql: string | null;
};

export async function sqliteClientToSqlmBytes(
  src: SqlClient,
  nowMs: number
): Promise<Uint8Array> {
  const mem = SqlClientImplSqliteMem.open({
    seed: 1,
    now: () => new Date(nowMs),
  });
  await mem.connect();
  try {
    await copyNativeIntoMem(src, mem);
    return mem.exportDatabaseBytes();
  } finally {
    await mem.disconnect();
  }
}

async function copyNativeIntoMem(
  src: SqlClient,
  dest: SqlClient
): Promise<void> {
  await dest.run(raw('PRAGMA foreign_keys = OFF'));
  const objects = await listSchemaObjects(src);
  for (const obj of objects) {
    if (obj.type !== 'table' || obj.sql == null) continue;
    await dest.run(raw(obj.sql));
    await copyTableRows(src, dest, obj.name);
  }
  for (const obj of objects) {
    if (obj.type === 'table' || obj.sql == null) continue;
    await dest.run(raw(obj.sql));
  }
  const userVersion = await readUserVersion(src);
  await dest.run(raw(`PRAGMA user_version = ${String(userVersion)}`));
  await dest.run(raw('PRAGMA foreign_keys = ON'));
}

async function listSchemaObjects(src: SqlClient): Promise<SchemaObject[]> {
  const rows = await src.query<{
    type: string;
    name: string;
    sql: string | null;
  }>(
    raw(`SELECT type, name, sql FROM sqlite_master
          WHERE name NOT LIKE 'sqlite_%'
          ORDER BY
            CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 1 ELSE 2 END,
            name COLLATE NOCASE`)
  );
  const out: SchemaObject[] = [];
  for (const r of rows) {
    if (r.type !== 'table' && r.type !== 'view' && r.type !== 'index') continue;
    if (r.name.length === 0) continue;
    out.push({
      type: r.type,
      name: r.name,
      sql: r.sql,
    });
  }
  return out;
}

async function readUserVersion(src: SqlClient): Promise<number> {
  const rows = await src.query<{ user_version: number }>(
    raw('PRAGMA user_version')
  );
  const n = rows[0]?.user_version;
  return typeof n === 'number' ? n : 0;
}

async function copyTableRows(
  src: SqlClient,
  dest: SqlClient,
  table: string
): Promise<void> {
  const rows = await src.query<Record<string, unknown>>(
    raw(`SELECT * FROM ${quoteIdent(table)}`)
  );
  for (const row of rows) {
    await insertRow(dest, table, row);
  }
}

async function insertRow(
  dest: SqlClient,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const cols = Object.keys(row).sort();
  if (cols.length === 0) return;
  const values = cols.map((c) => sql`${row[c] as never}`);
  await dest.run(
    sql`INSERT INTO ${ident(table)} (${join(cols.map((c) => ident(c)))}) VALUES (${join(values)})`
  );
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
