import { assert } from '@pkgs/assert';
import { ident, join, sql, unsafe, type Value } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../core/types';

export function assertTableName(table: string): void {
  assert.ok(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table), `bad table: ${table}`);
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

export async function upsertRowIntersect(
  tx: SqlClient,
  table: string,
  row: QueryRow,
  localCols: readonly string[]
): Promise<void> {
  assertTableName(table);
  const cols = localCols.filter((c) =>
    Object.prototype.hasOwnProperty.call(row, c)
  );
  assert.ok(cols.includes('id'), `${table}: id required`);
  const colIdents = cols.map((c) => ident(c));
  const valueFrags = cols.map((c) => sql`${(row[c] ?? null) as Value}`);
  const assignments = cols
    .filter((c) => c !== 'id')
    .map((c) => sql`${ident(c)} = excluded.${ident(c)}`);

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

/** Remove scope tags for absent ids; delete rows with empty tag sets. */
export async function purgeScopeAbsence(
  tx: SqlClient,
  table: string,
  scopeHash: string,
  presentIds: readonly string[]
): Promise<void> {
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
    const remaining = await tx.query(sql<{ n: number }>`
      SELECT COUNT(*) AS n FROM _row_scopes
      WHERE tbl = ${table} AND row_id = ${row_id}
    `);
    if ((remaining[0]?.n ?? 0) === 0) {
      await tx.run(sql`
        DELETE FROM ${ident(table)} WHERE id = ${row_id}
      `);
    }
  }
}

export async function deleteOrphanRow(
  tx: SqlClient,
  table: string,
  rowId: string
): Promise<void> {
  assertTableName(table);
  const remaining = await tx.query(sql<{ n: number }>`
    SELECT COUNT(*) AS n FROM _row_scopes
    WHERE tbl = ${table} AND row_id = ${rowId}
  `);
  if ((remaining[0]?.n ?? 0) === 0) {
    await tx.run(sql`DELETE FROM ${ident(table)} WHERE id = ${rowId}`);
  }
}

/**
 * Drop optimistic rows with no scope tags that are absent from this merge.
 * Rebase re-inserts still-pending mutations afterward.
 */
export async function deleteUntaggedOrphans(
  tx: SqlClient,
  table: string,
  presentIds: readonly string[]
): Promise<void> {
  assertTableName(table);
  const present = new Set(presentIds);
  const orphans = await tx.query(sql<{ id: string }>`
    SELECT t.id AS id FROM ${ident(table)} t
    WHERE NOT EXISTS (
      SELECT 1 FROM _row_scopes r
      WHERE r.tbl = ${table} AND r.row_id = t.id
    )
  `);
  for (const { id } of orphans) {
    if (present.has(id)) continue;
    await tx.run(sql`DELETE FROM ${ident(table)} WHERE id = ${id}`);
  }
}
