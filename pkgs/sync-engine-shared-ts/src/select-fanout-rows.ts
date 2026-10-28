import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { ident, join } from '@pkgs/sql-root-shared-ts/sql';
import { MAX_FANOUT_BYTES, MAX_FANOUT_ROWS } from './bounds';
import type { QueryRow } from './v2';

const MAX_SQLITE_VARS = 999;

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
    if (unique.length > MAX_FANOUT_ROWS) continue;
    const maxIds = Math.max(1, MAX_SQLITE_VARS);
    const rows: QueryRow[] = [];
    for (let offset = 0; offset < unique.length; offset += maxIds) {
      const chunk = unique.slice(offset, offset + maxIds);
      const idFrags = chunk.map((id) => sql`${id}`);
      const part = await db.query(sql<QueryRow>`
        SELECT * FROM ${ident(table)}
        WHERE id IN (${join(idFrags)})
      `);
      rows.push(...part);
    }
    if (rows.length > 0) out[table] = rows;
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

/**
 * The row images a mutation batch's push carries, or `undefined` when its
 * readers must read again through their own queries instead. Images are a
 * push's whole news: a reader that applies them does not refetch. So a
 * table written without post-images (no `RETURNING`, so neither images nor
 * ids) makes every image partial, and sending the rest would drop that
 * table's change: a private Battleship setup written beside its game's
 * public row never reached its owner's devices.
 */
export async function fanoutRowsForCapture(
  db: SqlClient,
  capture: {
    readonly tables: readonly string[];
    readonly ids: Readonly<Record<string, readonly string[]>>;
    readonly images: Readonly<Record<string, readonly QueryRow[]>>;
  }
): Promise<Record<string, QueryRow[]> | undefined> {
  if (Object.keys(capture.images).length > 0) {
    if (capture.tables.some((table) => capture.images[table] === undefined))
      return undefined;
    if (!fanoutRowsWithinCap(capture.images)) return undefined;
    const copy: Record<string, QueryRow[]> = {};
    for (const [table, rows] of Object.entries(capture.images)) {
      copy[table] = rows.map((r) => ({ ...r }));
    }
    return copy;
  }
  if (capture.tables.some((table) => capture.ids[table] === undefined))
    return undefined;
  const rows = await selectFanoutRows(db, capture.ids);
  if (Object.keys(rows).length === 0) return undefined;
  if (!fanoutRowsWithinCap(rows)) return undefined;
  return rows;
}
