import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { ident, join } from '@pkgs/sql-root-shared-ts/sql';
import { SYNC_ENGINE_OPTIMISTIC_PEER_ROWS } from '@pkgs/sync-engine-shared-ts/tables';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

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

/** Authoritative apply confirmed these ids — drop speculative markers. */
export async function clearOptimisticPeerRows(
  tx: SqlClient,
  tables: Readonly<Record<string, readonly QueryRow[]>>,
  nowIso: string
): Promise<void> {
  for (const [table, rows] of Object.entries(tables)) {
    assertTableName(table);
    const ids = collectIds(rows);
    if (ids.length === 0) continue;
    const maxIds = Math.max(1, MAX_SQLITE_VARS - 1);
    for (let offset = 0; offset < ids.length; offset += maxIds) {
      const chunk = ids.slice(offset, offset + maxIds);
      await tx.run(sql`
        UPDATE ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
        SET deleted_at = ${nowIso}, updated_at = ${nowIso}
        WHERE table_name = ${table}
          AND row_id IN (${join(chunk.map((id) => sql`${id}`))})
          AND deleted_at IS NULL
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

async function softDeletePeerRowsChunked(
  tx: SqlClient,
  table: string,
  ids: readonly string[],
  nowIso: string
): Promise<void> {
  if (ids.length === 0) return;
  const maxIds = Math.max(1, MAX_SQLITE_VARS - 1);
  for (let offset = 0; offset < ids.length; offset += maxIds) {
    const chunk = ids.slice(offset, offset + maxIds);
    await tx.run(sql`
      UPDATE ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
      SET deleted_at = ${nowIso}, updated_at = ${nowIso}
      WHERE table_name = ${table}
        AND row_id IN (${join(chunk.map((id) => sql`${id}`))})
        AND deleted_at IS NULL
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
    await softDeletePeerRowsChunked(tx, table, chunk, nowIso);
  }
}

async function loadPendingMutationIds(tx: SqlClient): Promise<Set<string>> {
  const rows = await tx.query(sql<{ id: string }>`
    SELECT id FROM sync_engine_mutations
    WHERE deleted_at IS NULL
  `);
  return new Set(rows.map((row) => row.id));
}

function markersWithoutPendingOwnWrites(
  markers: readonly { row_id: string; mutation_id: string | null }[],
  pendingIds: ReadonlySet<string>
): { row_id: string }[] {
  const out: { row_id: string }[] = [];
  for (const marker of markers) {
    const mutationId = marker.mutation_id;
    if (
      typeof mutationId === 'string' &&
      mutationId.length > 0 &&
      pendingIds.has(mutationId)
    ) {
      continue;
    }
    out.push({ row_id: marker.row_id });
  }
  return out;
}

async function healOrphansForTable(
  tx: SqlClient,
  table: string,
  rows: readonly QueryRow[],
  context: { readonly nowIso: string; readonly pendingIds: ReadonlySet<string> }
): Promise<boolean> {
  const { nowIso, pendingIds } = context;
  assertTableName(table);
  const present = collectPresentIds(rows);
  const markers = await tx.query(
    sql<{ row_id: string; mutation_id: string | null }>`
      SELECT row_id, mutation_id FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
      WHERE table_name = ${table}
        AND deleted_at IS NULL
    `
  );
  const healable = markersWithoutPendingOwnWrites(markers, pendingIds);
  const { confirmed, orphans } = partitionPeerMarkers(healable, present);
  await softDeletePeerRowsChunked(tx, table, confirmed, nowIso);
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
    WHERE deleted_at IS NULL
  `);
  if (Number(markerRows[0]?.c ?? 0) === 0) return [];

  const pendingIds = await loadPendingMutationIds(tx);
  const changed: string[] = [];
  for (const [table, rows] of Object.entries(snapshotTables)) {
    if (await healOrphansForTable(tx, table, rows, { nowIso, pendingIds })) {
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
      AND deleted_at IS NULL
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
    WHERE deleted_at IS NULL
  `);
  if (Number(markerRows[0]?.c ?? 0) === 0) return [];

  const tables = await tx.query(sql<{ table_name: string }>`
    SELECT DISTINCT table_name FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
    WHERE deleted_at IS NULL
  `);
  const pendingIds = await loadPendingMutationIds(tx);
  const changed: string[] = [];
  for (const row of tables) {
    const table = row.table_name;
    const marked = await loadMarkedRowsForTable(tx, table);
    if (await healOrphansForTable(tx, table, marked, { nowIso, pendingIds })) {
      if (!changed.includes(table)) changed.push(table);
    }
  }
  return changed;
}
