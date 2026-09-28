// @sql-vendor-ok — local SQLite client uses PRAGMA table_info for merge.
import { assert } from '@pkgs/assert';
import { bulk, ident, join, sql, unsafe, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { MutationEnv } from '../mutations/core/types';
import type { QueryRow } from '../queries/core/types';

/**
 * Lowest common SQLITE_MAX_VARIABLE_NUMBER on mobile / wasm SQLite.
 * Chunk so cols * rows stays under this.
 */
const MAX_SQLITE_VARS = 999;

const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function assertTableName(table: string): void {
  assert.ok(TABLE_NAME_RE.test(table), `bad table: ${table}`);
}

export function isValidTableName(table: string): boolean {
  return TABLE_NAME_RE.test(table);
}

export function isValidRowId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0;
}

/**
 * Postgres jsonb / JSON wire values arrive as objects or arrays. The web
 * SQLite only accepts string | number | null | Uint8Array binds.
 */
export function sqliteWireValue(value: unknown): Value {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const pragmaCache = new WeakMap<object, Map<string, readonly string[]>>();

export async function tableColumns(
  tx: SqlClient,
  table: string
): Promise<readonly string[]> {
  assertTableName(table);
  let byTable = pragmaCache.get(tx);
  if (byTable === undefined) {
    byTable = new Map();
    pragmaCache.set(tx, byTable);
  }
  const cached = byTable.get(table);
  if (cached !== undefined) return cached;
  const info = await tx.query(
    unsafe<{ name: string }>(`PRAGMA table_info("${table}")`)
  );
  const cols = info.map((c) => c.name);
  // Do not cache empty — unknown tables become real after mid-life migrate.
  if (cols.length > 0) byTable.set(table, cols);
  return cols;
}

function withManagedDefaults(
  row: QueryRow,
  localCols: readonly string[],
  env: MutationEnv
): QueryRow {
  const filled: Record<string, unknown> = { ...row };
  const nowIso = env.now().toISOString();
  if (localCols.includes('id') && filled['id'] == null) {
    filled['id'] = env.createId();
  }
  if (localCols.includes('created_at') && filled['created_at'] == null) {
    filled['created_at'] = nowIso;
  }
  if (localCols.includes('updated_at') && filled['updated_at'] == null) {
    filled['updated_at'] = nowIso;
  }
  return filled as QueryRow;
}

/** Columns present on the row ∩ local schema — never invent missing keys as NULL. */
function intersectCols(
  filled: QueryRow,
  localCols: readonly string[]
): readonly string[] {
  return localCols.filter((c) =>
    Object.prototype.hasOwnProperty.call(filled, c)
  );
}

function columnSignature(cols: readonly string[]): string {
  return cols.join('\0');
}

async function upsertRowsSameCols(args: {
  readonly tx: SqlClient;
  readonly table: string;
  readonly cols: readonly string[];
  readonly filledRows: readonly QueryRow[];
}): Promise<void> {
  const { tx, table, cols, filledRows } = args;
  if (filledRows.length === 0) return;
  assert.ok(cols.includes('id'), `${table}: id required`);

  const colIdents = cols.map((c) => ident(c));
  const assignments = cols
    .filter((c) => c !== 'id')
    .map((c) => sql`${ident(c)} = excluded.${ident(c)}`);

  const maxRows = Math.max(1, Math.floor(MAX_SQLITE_VARS / cols.length));
  for (let offset = 0; offset < filledRows.length; offset += maxRows) {
    const chunk = filledRows.slice(offset, offset + maxRows);
    const data = chunk.map((row) =>
      cols.map((c) => sqliteWireValue(row[c]) as Value)
    );

    if (assignments.length === 0) {
      await tx.run(sql`
        INSERT INTO ${ident(table)} (${join(colIdents)})
        VALUES ${bulk(data)}
        ON CONFLICT (id) DO NOTHING
      `);
      continue;
    }

    await tx.run(sql`
      INSERT INTO ${ident(table)} (${join(colIdents)})
      VALUES ${bulk(data)}
      ON CONFLICT (id) DO UPDATE SET ${join(assignments)}
    `);
  }
}

/**
 * Upsert intersecting columns verbatim (including `deleted_at`).
 * Groups by column signature so missing keys are never bound as NULL.
 */
export async function upsertRowsIntersect(args: {
  readonly tx: SqlClient;
  readonly table: string;
  readonly rows: readonly QueryRow[];
  readonly localCols: readonly string[];
  readonly env: MutationEnv;
  readonly skipInvalidIds?: boolean;
}): Promise<boolean> {
  const { tx, table, rows, localCols, env } = args;
  assertTableName(table);
  if (rows.length === 0) return false;

  const bySig = new Map<
    string,
    { cols: readonly string[]; rows: QueryRow[] }
  >();
  for (const row of rows) {
    const id = row['id'];
    if (!isValidRowId(id)) {
      if (args.skipInvalidIds === true) continue;
      assert.fail(`${table}: row id required`);
    }
    const filled = withManagedDefaults(row, localCols, env);
    const cols = intersectCols(filled, localCols);
    assert.ok(cols.includes('id'), `${table}: id required`);
    const sig = columnSignature(cols);
    const group = bySig.get(sig);
    if (group === undefined) {
      bySig.set(sig, { cols, rows: [filled] });
    } else {
      group.rows.push(filled);
    }
  }

  if (bySig.size === 0) return false;

  for (const group of bySig.values()) {
    await upsertRowsSameCols({
      tx,
      table,
      cols: group.cols,
      filledRows: group.rows,
    });
  }
  return true;
}

/** Columns a merge fills itself when an image leaves them out. */
const FILLED_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

/** A pushed row image that would create a row with columns missing. */
export class IncompleteRowImageError extends Error {
  override readonly name = 'IncompleteRowImageError';
}

/**
 * A pushed image of a row the device does not hold yet must carry every
 * column the device keeps for that table: inserting it otherwise would show
 * a row with empty fields (a garbled push that renamed `body` would show a
 * note with no text). Such a push is refused, and the caller refetches the
 * row whole. Images of rows the device holds may be partial: missing columns
 * keep their value (a device-only column survives).
 */
export async function assertCompleteNewRowImages(
  tx: SqlClient,
  table: string,
  rows: readonly QueryRow[]
): Promise<void> {
  const cols = await tableColumns(tx, table);
  if (cols.length === 0) return;
  const required = cols.filter((c) => !FILLED_COLUMNS.has(c));
  const ids = rows.map((row) => row['id']).filter(isValidRowId);
  if (ids.length === 0) return;
  const held = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += MAX_SQLITE_VARS) {
    const chunk = ids.slice(offset, offset + MAX_SQLITE_VARS);
    const found = await tx.query(sql<{ id: string }>`
      SELECT id FROM ${ident(table)}
      WHERE id IN (${join(chunk.map((id) => sql`${id}`))})
    `);
    for (const row of found) held.add(row.id);
  }
  for (const row of rows) {
    const id = row['id'];
    if (!isValidRowId(id) || held.has(id)) continue;
    const missing = required.filter(
      (c) => !Object.prototype.hasOwnProperty.call(row, c)
    );
    if (missing.length > 0) {
      throw new IncompleteRowImageError(
        `${table} ${id}: new row image lacks ${missing.join(', ')}`
      );
    }
  }
}

export async function mergeTable(args: {
  readonly tx: SqlClient;
  readonly table: string;
  readonly rows: readonly QueryRow[];
  readonly env: MutationEnv;
  readonly skipInvalidIds?: boolean;
}): Promise<boolean> {
  const cols = await tableColumns(args.tx, args.table);
  if (cols.length === 0) return false;
  return upsertRowsIntersect({
    tx: args.tx,
    table: args.table,
    rows: args.rows,
    localCols: cols,
    env: args.env,
    ...(args.skipInvalidIds === true ? { skipInvalidIds: true } : {}),
  });
}
