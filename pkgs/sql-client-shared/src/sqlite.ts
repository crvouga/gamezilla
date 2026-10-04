/**
 * SQLite dialect: list user tables, dump rows, load rows.
 */

import sql, { ident, join, raw } from '@pkgs/sql-shared/sql';
import type { SqlClient } from './interface';
import { rowToDumpValues } from './cell-codec';
import { SQL_DATA_DUMP_VERSION } from './types';
import type { SqlDataDump, SqlDataDumpOptions, SqlTableDump } from './types';

export async function listSqliteUserTables(
  client: SqlClient
): Promise<readonly string[]> {
  const rows = await client.query<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name COLLATE NOCASE ASC`
  );
  return rows.map((r) => r.name);
}

async function dumpSqliteTable(
  client: SqlClient,
  table: string
): Promise<SqlTableDump> {
  const rows = await client.query<Record<string, unknown>>(
    raw(`SELECT * FROM ${quoteIdent(table)}`)
  );
  if (rows.length === 0) {
    const info = await client.query<{ name: string }>(
      raw(`PRAGMA table_info(${quoteIdent(table)})`)
    );
    const columns = info.map((c) => c.name).sort();
    return { columns, rows: [] };
  }
  const columns = Object.keys(rows[0]!).sort();
  return {
    columns,
    rows: rows.map((row) => rowToDumpValues(columns, row)),
  };
}

export async function dumpSqliteData(
  client: SqlClient,
  opts?: SqlDataDumpOptions
): Promise<SqlDataDump> {
  const allTables = await listSqliteUserTables(client);
  const tables =
    opts?.tables !== undefined
      ? opts.tables.filter((t) => allTables.includes(t))
      : allTables;
  const out: Record<string, SqlTableDump> = {};
  for (const table of tables) {
    out[table] = await dumpSqliteTable(client, table);
  }
  return { version: SQL_DATA_DUMP_VERSION, tables: out };
}

export async function loadSqliteData(
  client: SqlClient,
  dump: SqlDataDump
): Promise<void> {
  if (dump.version !== SQL_DATA_DUMP_VERSION) {
    throw new Error(
      `loadSqliteData: unsupported dump version ${String(dump.version)}`
    );
  }
  await client.run(raw('PRAGMA foreign_keys = OFF'));
  try {
    const tableNames = Object.keys(dump.tables).sort();
    for (const table of tableNames) {
      await client.run(sql`DELETE FROM ${ident(table)}`);
    }
    for (const table of tableNames) {
      const slice = dump.tables[table];
      if (slice === undefined) continue;
      await insertTableDump(client, table, slice);
    }
  } finally {
    await client.run(raw('PRAGMA foreign_keys = ON'));
  }
}

async function insertTableDump(
  client: SqlClient,
  table: string,
  slice: SqlTableDump
): Promise<void> {
  const { columns, rows } = slice;
  if (columns.length === 0 || rows.length === 0) return;
  for (const row of rows) {
    const values = columns.map((_, i) => sql`${row[i] as never}`);
    await client.run(
      sql`INSERT INTO ${ident(table)} (${join(columns.map((c) => ident(c)))}) VALUES (${join(values)})`
    );
  }
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}
