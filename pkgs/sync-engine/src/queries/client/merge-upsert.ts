import { assert } from '@pkgs/assert';
import { ident, join, sql, unsafe, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../core/types';

export const DELETED_AT_COLUMN = '_deleted_at';

export function assertTableName(table: string): void {
  assert.ok(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table), `bad table: ${table}`);
}

/**
 * Postgres jsonb / JSON wire values arrive as objects or arrays. expo-sqlite
 * only accepts string | number | null | Uint8Array binds — objects throw
 * `Unsupported parameter type: object` and abort the whole merge txn.
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

export async function tableColumns(
  tx: SqlClient,
  table: string
): Promise<readonly string[]> {
  assertTableName(table);
  const info = await tx.query(
    unsafe<{ name: string }>(`PRAGMA table_info("${table}")`)
  );
  return info.map((c) => c.name);
}

export function assertHasDeletedAt(
  table: string,
  localCols: readonly string[]
): void {
  assert.ok(
    localCols.includes(DELETED_AT_COLUMN),
    `${table}: hydrated domain tables require ${DELETED_AT_COLUMN}`
  );
}

/**
 * Upsert intersecting columns and always revive `_deleted_at = NULL` when the
 * local table has that column (present in a live query ⇒ live row).
 */
export async function upsertRowIntersect(
  tx: SqlClient,
  table: string,
  row: QueryRow,
  localCols: readonly string[]
): Promise<void> {
  assertTableName(table);
  assertHasDeletedAt(table, localCols);
  const cols = localCols.filter(
    (c) =>
      c !== DELETED_AT_COLUMN && Object.prototype.hasOwnProperty.call(row, c)
  );
  assert.ok(cols.includes('id'), `${table}: id required`);

  const writeCols = [...cols, DELETED_AT_COLUMN];
  const colIdents = writeCols.map((c) => ident(c));
  const valueFrags = writeCols.map((c) =>
    c === DELETED_AT_COLUMN ? sql`${null}` : sql`${sqliteWireValue(row[c])}`
  );
  const assignments = writeCols
    .filter((c) => c !== 'id')
    .map((c) =>
      c === DELETED_AT_COLUMN
        ? sql`${ident(c)} = NULL`
        : sql`${ident(c)} = excluded.${ident(c)}`
    );

  if (assignments.length === 0) {
    await tx.run(sql`
      INSERT INTO ${ident(table)} (${join(colIdents)})
      VALUES (${join(valueFrags)})
      ON CONFLICT (id) DO NOTHING
    `);
    return;
  }

  await tx.run(sql`
    INSERT INTO ${ident(table)} (${join(colIdents)})
    VALUES (${join(valueFrags)})
    ON CONFLICT (id) DO UPDATE SET ${join(assignments)}
  `);
}

export async function tagRow(
  tx: SqlClient,
  table: string,
  rowId: string,
  scopeHash: string
): Promise<void> {
  await tx.run(sql`
    INSERT OR IGNORE INTO _row_scopes (tbl, row_id, scope_hash)
    VALUES (${table}, ${rowId}, ${scopeHash})
  `);
}

async function softTombstoneRow(
  tx: SqlClient,
  table: string,
  rowId: string,
  now: string
): Promise<void> {
  assertTableName(table);
  await tx.run(sql`
    UPDATE ${ident(table)}
    SET ${ident(DELETED_AT_COLUMN)} = ${now}
    WHERE id = ${rowId} AND ${ident(DELETED_AT_COLUMN)} IS NULL
  `);
}

/** Soft-tombstone a row when no scope tags remain. */
export async function softTombstoneOrphanRow(
  tx: SqlClient,
  table: string,
  rowId: string,
  now: string
): Promise<void> {
  assertTableName(table);
  const remaining = await tx.query(sql<{ n: number }>`
    SELECT COUNT(*) AS n FROM _row_scopes
    WHERE tbl = ${table} AND row_id = ${rowId}
  `);
  if ((remaining[0]?.n ?? 0) === 0) {
    await softTombstoneRow(tx, table, rowId, now);
  }
}

/**
 * Remove scope tags for absent ids; soft-tombstone rows with empty tag sets.
 */
export async function softTombstoneScopeAbsence(
  tx: SqlClient,
  args: {
    readonly table: string;
    readonly scopeHash: string;
    readonly presentIds: readonly string[];
    readonly now: string;
  }
): Promise<void> {
  const { table, scopeHash, presentIds, now } = args;
  assertTableName(table);
  const tagged = await tx.query(sql<{ row_id: string }>`
    SELECT row_id FROM _row_scopes
    WHERE tbl = ${table} AND scope_hash = ${scopeHash}
  `);
  const present = new Set(presentIds);
  for (const { row_id } of tagged) {
    if (present.has(row_id)) continue;
    await tx.run(sql`
      DELETE FROM _row_scopes
      WHERE tbl = ${table} AND row_id = ${row_id} AND scope_hash = ${scopeHash}
    `);
    await softTombstoneOrphanRow(tx, table, row_id, now);
  }
}

/**
 * Soft-tombstone optimistic rows with no scope tags that are absent from this
 * merge. Rebase re-inserts still-pending mutations afterward.
 */
export async function softTombstoneUntaggedOrphans(
  tx: SqlClient,
  table: string,
  presentIds: readonly string[],
  now: string
): Promise<void> {
  assertTableName(table);
  const present = new Set(presentIds);
  const orphans = await tx.query(sql<{ id: string }>`
    SELECT t.id AS id
    FROM ${ident(table)} AS t
    WHERE t._deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM _row_scopes AS r
        WHERE r.tbl = ${table} AND r.row_id = t.id
      )
  `);
  for (const { id } of orphans) {
    if (present.has(id)) continue;
    await softTombstoneRow(tx, table, id, now);
  }
}
