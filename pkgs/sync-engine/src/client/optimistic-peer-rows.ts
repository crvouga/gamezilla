import { assert } from '@pkgs/assert';
import { bulk, ident, join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../queries/core/types';
import { SYNC_ENGINE_OPTIMISTIC_PEER_ROWS } from '../shared/framework-server-ddl';

const MAX_SQLITE_VARS = 999;

function assertTableName(table: string): void {
  assert.ok(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table), `bad table: ${table}`);
}

function collectIds(rows: readonly QueryRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    const id = row['id'];
    if (typeof id === 'string' && id.length > 0) ids.push(id);
  }
  return ids;
}

/** Record peer-applied optimistic row images so a later snapshot can heal orphans. */
export async function recordOptimisticPeerRows(
  tx: SqlClient,
  tables: Readonly<Record<string, readonly QueryRow[]>>
): Promise<void> {
  for (const [table, rows] of Object.entries(tables)) {
    assertTableName(table);
    const ids = collectIds(rows);
    if (ids.length === 0) continue;
    // 2 binds per row (table_name, row_id).
    const maxRows = Math.max(1, Math.floor(MAX_SQLITE_VARS / 2));
    for (let offset = 0; offset < ids.length; offset += maxRows) {
      const chunk = ids.slice(offset, offset + maxRows);
      const data = chunk.map((id) => [table, id] as const);
      await tx.run(sql`
        INSERT INTO ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)} (table_name, row_id)
        VALUES ${bulk(data)}
        ON CONFLICT (table_name, row_id) DO NOTHING
      `);
    }
  }
}

/** Authoritative apply confirmed these ids — drop speculative markers. */
export async function clearOptimisticPeerRows(
  tx: SqlClient,
  tables: Readonly<Record<string, readonly QueryRow[]>>
): Promise<void> {
  for (const [table, rows] of Object.entries(tables)) {
    assertTableName(table);
    const ids = collectIds(rows);
    if (ids.length === 0) continue;
    const maxIds = Math.max(1, MAX_SQLITE_VARS - 1);
    for (let offset = 0; offset < ids.length; offset += maxIds) {
      const chunk = ids.slice(offset, offset + maxIds);
      await tx.run(sql`
        DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
        WHERE table_name = ${table}
          AND row_id IN (${join(chunk.map((id) => sql`${id}`))})
      `);
    }
  }
}

function collectPresentIds(rows: readonly QueryRow[]): Set<string> {
  const present = new Set<string>();
  for (const row of rows) {
    const id = row['id'];
    if (typeof id === 'string' && id.length > 0) present.add(id);
  }
  return present;
}

function partitionPeerMarkers(
  markers: readonly { row_id: string }[],
  present: Set<string>
): { confirmed: string[]; orphans: string[] } {
  const confirmed: string[] = [];
  const orphans: string[] = [];
  for (const marker of markers) {
    if (present.has(marker.row_id)) confirmed.push(marker.row_id);
    else orphans.push(marker.row_id);
  }
  return { confirmed, orphans };
}

async function deletePeerRowsChunked(
  tx: SqlClient,
  table: string,
  ids: readonly string[]
): Promise<void> {
  if (ids.length === 0) return;
  const maxIds = Math.max(1, MAX_SQLITE_VARS - 1);
  for (let offset = 0; offset < ids.length; offset += maxIds) {
    const chunk = ids.slice(offset, offset + maxIds);
    await tx.run(sql`
      DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
      WHERE table_name = ${table}
        AND row_id IN (${join(chunk.map((id) => sql`${id}`))})
    `);
  }
}

async function softDeleteOrphanRows(
  tx: SqlClient,
  table: string,
  orphans: readonly string[],
  nowIso: string
): Promise<void> {
  if (orphans.length === 0) return;
  const maxIds = Math.max(1, MAX_SQLITE_VARS - 1);
  for (let offset = 0; offset < orphans.length; offset += maxIds) {
    const chunk = orphans.slice(offset, offset + maxIds);
    await tx.run(sql`
      UPDATE ${ident(table)}
      SET deleted_at = ${nowIso}
      WHERE id IN (${join(chunk.map((id) => sql`${id}`))})
        AND deleted_at IS NULL
    `);
    await deletePeerRowsChunked(tx, table, chunk);
  }
}

async function healOrphansForTable(
  tx: SqlClient,
  table: string,
  rows: readonly QueryRow[],
  nowIso: string
): Promise<boolean> {
  assertTableName(table);
  const present = collectPresentIds(rows);
  const markers = await tx.query(sql<{ row_id: string }>`
    SELECT row_id FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
    WHERE table_name = ${table}
  `);
  const { confirmed, orphans } = partitionPeerMarkers(markers, present);
  await deletePeerRowsChunked(tx, table, confirmed);
  await softDeleteOrphanRows(tx, table, orphans, nowIso);
  return orphans.length > 0;
}

/**
 * Soft-delete domain rows that only arrived via optimistic fanout / own
 * pending writes and are absent from a confirming snapshot (upsert-only
 * merge cannot remove them).
 */
export async function healOptimisticPeerOrphans(
  tx: SqlClient,
  snapshotTables: Readonly<Record<string, readonly QueryRow[]>>,
  nowIso: string
): Promise<readonly string[]> {
  const markerRows = await tx.query(sql<{ c: number | string }>`
    SELECT COUNT(*) AS c FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
  `);
  if (Number(markerRows[0]?.c ?? 0) === 0) return [];

  const changed: string[] = [];
  for (const [table, rows] of Object.entries(snapshotTables)) {
    if (await healOrphansForTable(tx, table, rows, nowIso)) {
      if (!changed.includes(table)) changed.push(table);
    }
  }
  return changed;
}

async function loadMarkedRowsForTable(
  tx: SqlClient,
  table: string
): Promise<QueryRow[]> {
  const markers = await tx.query(sql<{ row_id: string }>`
    SELECT row_id FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
    WHERE table_name = ${table}
  `);
  if (markers.length === 0) return [];
  const rows: QueryRow[] = [];
  const maxIds = Math.max(1, MAX_SQLITE_VARS - 1);
  for (let offset = 0; offset < markers.length; offset += maxIds) {
    const chunk = markers.slice(offset, offset + maxIds).map((m) => m.row_id);
    const part = await tx.query(sql<QueryRow>`
      SELECT * FROM ${ident(table)}
      WHERE id IN (${join(chunk.map((id) => sql`${id}`))})
    `);
    rows.push(...part);
  }
  return rows;
}

/**
 * Heal markers for every table that still has peer-row bookkeeping after
 * domain convergence (snapshots may not have covered the table on last merge).
 */
export async function reconcileOptimisticPeerMarkers(
  tx: SqlClient,
  nowIso: string
): Promise<readonly string[]> {
  const markerRows = await tx.query(sql<{ c: number | string }>`
    SELECT COUNT(*) AS c FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
  `);
  if (Number(markerRows[0]?.c ?? 0) === 0) return [];

  const tables = await tx.query(sql<{ table_name: string }>`
    SELECT DISTINCT table_name FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
  `);
  const changed: string[] = [];
  for (const row of tables) {
    const table = row.table_name;
    const marked = await loadMarkedRowsForTable(tx, table);
    if (await healOrphansForTable(tx, table, marked, nowIso)) {
      if (!changed.includes(table)) changed.push(table);
    }
  }
  return changed;
}
