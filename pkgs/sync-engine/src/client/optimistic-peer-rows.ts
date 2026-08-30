import { bulk, ident, join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../queries/core/types';
import { SYNC_ENGINE_OPTIMISTIC_PEER_ROWS } from '../shared/framework-server-ddl';

const MAX_SQLITE_VARS = 999;

function assertTableName(table: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`bad table: ${table}`);
  }
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
  const changed: string[] = [];
  for (const [table, rows] of Object.entries(snapshotTables)) {
    assertTableName(table);
    const present = new Set<string>();
    for (const row of rows) {
      const id = row['id'];
      if (typeof id === 'string' && id.length > 0) present.add(id);
    }
    const markers = await tx.query(sql<{ row_id: string }>`
      SELECT row_id FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
      WHERE table_name = ${table}
    `);
    const confirmed: string[] = [];
    const orphans: string[] = [];
    for (const marker of markers) {
      if (present.has(marker.row_id)) confirmed.push(marker.row_id);
      else orphans.push(marker.row_id);
    }
    if (confirmed.length > 0) {
      const maxIds = Math.max(1, MAX_SQLITE_VARS - 1);
      for (let offset = 0; offset < confirmed.length; offset += maxIds) {
        const chunk = confirmed.slice(offset, offset + maxIds);
        await tx.run(sql`
          DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
          WHERE table_name = ${table}
            AND row_id IN (${join(chunk.map((id) => sql`${id}`))})
        `);
      }
    }
    for (const rowId of orphans) {
      // Speculative insert never confirmed — tombstone locally so live reads match server.
      await tx.run(sql`
        UPDATE ${ident(table)}
        SET deleted_at = ${nowIso}
        WHERE id = ${rowId} AND deleted_at IS NULL
      `);
      await tx.run(sql`
        DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
        WHERE table_name = ${table} AND row_id = ${rowId}
      `);
      if (!changed.includes(table)) changed.push(table);
    }
  }
  return changed;
}
