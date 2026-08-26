/**
 * Postgres dialect: list user tables, dump rows, load rows.
 */

import { ident, join, raw, sql } from '@pkgs/sql';
import type { PostgresSqlClient } from '../interface';
import { quotePgIdent } from '../postgres/schema';
import { rowToDumpValues } from './cell-codec';
import {
  SQL_DATA_DUMP_VERSION,
  type SqlDataDump,
  type SqlDataDumpOptions,
  type SqlTableDump,
} from './types';

export async function listPostgresUserTables(
  client: PostgresSqlClient
): Promise<readonly string[]> {
  const schema = client.dbScope.schema;
  const rows = await client.query<{ name: string }>(sql`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = ${schema}
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map((r) => r.name);
}

async function postgresTableColumns(
  client: PostgresSqlClient,
  table: string
): Promise<readonly string[]> {
  const schema = client.dbScope.schema;
  const info = await client.query<{ column_name: string }>(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ${schema} AND table_name = ${table}
    ORDER BY ordinal_position
  `);
  return info.map((c) => c.column_name);
}

function postgresRowValues(
  columns: readonly string[],
  row: Record<string, unknown>
): readonly import('./types').SqlDumpValue[] {
  const byLower = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    byLower.set(key.toLowerCase(), value);
  }
  return rowToDumpValues(
    columns,
    Object.fromEntries(
      columns.map((col) => [col, byLower.get(col.toLowerCase()) ?? null])
    )
  );
}

async function dumpPostgresTable(
  client: PostgresSqlClient,
  table: string
): Promise<SqlTableDump> {
  const columns = await postgresTableColumns(client, table);
  const rows = await client.query<Record<string, unknown>>(
    sql`SELECT * FROM ${ident(table)}`
  );
  return {
    columns,
    rows: rows.map((row) => postgresRowValues(columns, row)),
  };
}

export async function dumpPostgresData(
  client: PostgresSqlClient,
  opts?: SqlDataDumpOptions
): Promise<SqlDataDump> {
  const allTables = await listPostgresUserTables(client);
  const tables =
    opts?.tables !== undefined
      ? opts.tables.filter((t) => allTables.includes(t))
      : allTables;
  const out: Record<string, SqlTableDump> = {};
  for (const table of tables) {
    out[table] = await dumpPostgresTable(client, table);
  }
  return { version: SQL_DATA_DUMP_VERSION, tables: out };
}

export async function loadPostgresData(
  client: PostgresSqlClient,
  dump: SqlDataDump
): Promise<void> {
  if (dump.version !== SQL_DATA_DUMP_VERSION) {
    throw new Error(
      `loadPostgresData: unsupported dump version ${String(dump.version)}`
    );
  }
  const schema = client.dbScope.schema;
  const tableNames = Object.keys(dump.tables).sort();
  if (tableNames.length === 0) return;

  const insertOrder = await postgresInsertOrder(client, tableNames);

  const quoted = tableNames.map(
    (t) => `${quotePgIdent(schema)}.${quotePgIdent(t)}`
  );
  try {
    await client.run(
      raw(`TRUNCATE TABLE ${quoted.join(', ')} RESTART IDENTITY CASCADE`)
    );
  } catch {
    for (const table of [...tableNames].reverse()) {
      await client.run(sql`DELETE FROM ${ident(table)}`);
    }
  }
  for (const table of insertOrder) {
    const slice = dump.tables[table];
    if (slice === undefined) continue;
    await insertTableDump(client, table, slice);
  }
}

async function postgresInsertOrder(
  client: PostgresSqlClient,
  tableNames: readonly string[]
): Promise<readonly string[]> {
  const schema = client.dbScope.schema;
  const edges = await client.query<{
    child_table: string;
    parent_table: string;
  }>(sql`
    SELECT
      child.relname AS child_table,
      parent.relname AS parent_table
    FROM pg_constraint AS con
    JOIN pg_class AS child ON child.oid = con.conrelid
    JOIN pg_namespace AS nsp ON nsp.oid = child.relnamespace
    JOIN pg_class AS parent ON parent.oid = con.confrelid
    WHERE con.contype = 'f'
      AND nsp.nspname = ${schema}
  `);
  const allowed = new Set(tableNames);
  const mustPrecede = new Map<string, Set<string>>();
  for (const table of tableNames) {
    mustPrecede.set(table, new Set());
  }
  for (const { child_table: child, parent_table: parent } of edges) {
    if (!allowed.has(child) || !allowed.has(parent) || child === parent) {
      continue;
    }
    mustPrecede.get(child)!.add(parent);
  }

  const remaining = new Set(tableNames);
  const sorted: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((table) => {
        for (const parent of mustPrecede.get(table) ?? []) {
          if (remaining.has(parent)) return false;
        }
        return true;
      })
      .sort();
    if (ready.length === 0) {
      throw new Error('loadPostgresData: cyclic foreign-key dependencies');
    }
    for (const table of ready) {
      sorted.push(table);
      remaining.delete(table);
    }
  }
  return sorted;
}

async function insertTableDump(
  client: PostgresSqlClient,
  table: string,
  slice: SqlTableDump
): Promise<void> {
  const { columns, rows } = slice;
  if (columns.length === 0 || rows.length === 0) return;
  for (const row of rows) {
    const values = columns.map((_, i) => sql`${row[i] as never}`);
    await client.run(
      sql`INSERT INTO ${ident(table)} (${join(
        columns.map((c) => raw(quotePgIdent(c)))
      )}) VALUES (${join(values)})`
    );
  }
}
