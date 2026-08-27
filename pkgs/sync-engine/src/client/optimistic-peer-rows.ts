import { ident, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../queries/core/types';
import { SYNC_ENGINE_OPTIMISTIC_PEER_ROWS } from '../shared/framework-server-ddl';

function assertTableName(table: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`bad table: ${table}`);
  }
}

/** Record peer-applied optimistic row images so a later snapshot can heal orphans. */
export async function recordOptimisticPeerRows(
  tx: SqlClient,
  tables: Readonly<Record<string, readonly QueryRow[]>>
): Promise<void> {
  for (const [table, rows] of Object.entries(tables)) {
    assertTableName(table);
    for (const row of rows) {
      const id = row['id'];
      if (typeof id !== 'string' || id.length === 0) continue;
      await tx.run(sql`
        INSERT INTO ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)} (table_name, row_id)
        VALUES (${table}, ${id})
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
    for (const row of rows) {
      const id = row['id'];
      if (typeof id !== 'string' || id.length === 0) continue;
      await tx.run(sql`
        DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
        WHERE table_name = ${table} AND row_id = ${id}
      `);
    }
  }
}

/**
 * Soft-delete domain rows that only arrived via optimistic peer fanout and are
 * absent from a confirming snapshot (upsert-only merge cannot remove them).
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
    for (const marker of markers) {
      if (present.has(marker.row_id)) {
        await tx.run(sql`
          DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
          WHERE table_name = ${table} AND row_id = ${marker.row_id}
        `);
        continue;
      }
      // Speculative insert never confirmed — tombstone locally so live reads match server.
      await tx.run(sql`
        UPDATE ${ident(table)}
        SET deleted_at = ${nowIso}
        WHERE id = ${marker.row_id} AND deleted_at IS NULL
      `);
      await tx.run(sql`
        DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
        WHERE table_name = ${table} AND row_id = ${marker.row_id}
      `);
      if (!changed.includes(table)) changed.push(table);
    }
  }
  return changed;
}
