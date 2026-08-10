import { assert } from '@pkgs/assert';
import { ident, join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../queries/core/types';
import { MAX_FANOUT_BYTES, MAX_FANOUT_ROWS } from '../queries/shared/bounds';

function assertTableName(table: string): void {
  assert.ok(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table), `bad table: ${table}`);
}

/**
 * Post-replay SELECT of affected domain rows for push fanout.
 *
 * This is the **only** legal source of fanout `rows` payloads — never derive
 * row images from mutation args. Includes `deleted_at` (no live filter).
 */
export async function selectFanoutRows(
  db: SqlClient,
  affected: Readonly<Record<string, readonly string[]>>
): Promise<Record<string, QueryRow[]>> {
  const out: Record<string, QueryRow[]> = {};
  for (const [table, ids] of Object.entries(affected)) {
    if (ids.length === 0) continue;
    assertTableName(table);
    const unique = [...new Set(ids)];
    const idFrags = unique.map((id) => sql`${id}`);
    // SELECT * so synced columns + `deleted_at` are included; no live filter.
    const rows = await db.query(sql<QueryRow>`
      SELECT * FROM ${ident(table)}
      WHERE id IN (${join(idFrags)})
    `);
    if (rows.length > 0) out[table] = [...rows];
  }
  return out;
}

/** Merge id maps from multiple mutations (union per table). */
export function mergeAffectedRows(
  parts: readonly Readonly<Record<string, readonly string[]>>[]
): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const part of parts) {
    for (const [table, ids] of Object.entries(part)) {
      let set = out[table];
      if (set === undefined) {
        set = new Set();
        out[table] = set;
      }
      for (const id of ids) set.add(id);
    }
  }
  const merged: Record<string, string[]> = {};
  for (const [table, set] of Object.entries(out)) {
    merged[table] = [...set];
  }
  return merged;
}

export function fanoutRowsWithinCap(
  rows: Readonly<Record<string, readonly QueryRow[]>>
): boolean {
  let count = 0;
  for (const list of Object.values(rows)) count += list.length;
  if (count > MAX_FANOUT_ROWS) return false;
  if (JSON.stringify(rows).length > MAX_FANOUT_BYTES) return false;
  return true;
}
