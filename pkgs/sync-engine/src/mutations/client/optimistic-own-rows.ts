import { assert } from '@pkgs/assert';
import { bulk, ident, join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  FRAMEWORK_TABLE_NAMES,
  SYNC_ENGINE_OPTIMISTIC_PEER_ROWS,
} from '../../shared/framework-server-ddl';
import { optimisticPeerRowId } from '../../shared/schema/tables';
import type { WriteCaptureSnapshot } from '../../sql-ast';

const FRAMEWORK_TABLE_SET: ReadonlySet<string> = new Set(FRAMEWORK_TABLE_NAMES);
const MAX_SQLITE_VARS = 999;

function assertTableName(table: string): void {
  assert.ok(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table), `bad table: ${table}`);
}

/** Record own mutation write-set so a later snapshot can tombstone rejected inserts. */
export async function recordOptimisticOwnRows(
  tx: SqlClient,
  mutationId: string,
  capture: WriteCaptureSnapshot,
  nowIso: string
): Promise<void> {
  for (const [table, ids] of Object.entries(capture.ids)) {
    if (FRAMEWORK_TABLE_SET.has(table)) continue;
    assertTableName(table);
    const unique = [...new Set(ids.filter((id) => id.length > 0))];
    if (unique.length === 0) continue;
    const maxRows = Math.max(1, Math.floor(MAX_SQLITE_VARS / 7));
    for (let offset = 0; offset < unique.length; offset += maxRows) {
      const chunk = unique.slice(offset, offset + maxRows);
      const data = chunk.map(
        (id) =>
          [
            optimisticPeerRowId(table, id),
            table,
            id,
            mutationId,
            nowIso,
            nowIso,
            null,
          ] as const
      );
      await tx.run(sql`
        DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
        WHERE table_name = ${table}
          AND row_id IN (${join(chunk.map((id) => sql`${id}`))})
      `);
      await tx.run(sql`
        INSERT INTO ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)} (
          id, table_name, row_id, mutation_id,
          created_at, updated_at, deleted_at
        )
        VALUES ${bulk(data)}
        ON CONFLICT (id) DO UPDATE SET
          mutation_id = excluded.mutation_id,
          updated_at = excluded.updated_at,
          deleted_at = NULL
      `);
    }
  }
}

/** Drop own markers after the server applied this mutation (row is real). */
export async function clearOptimisticRowsForMutation(
  tx: SqlClient,
  mutationId: string,
  nowIso: string
): Promise<void> {
  await tx.run(sql`
    UPDATE ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
    SET deleted_at = ${nowIso}, updated_at = ${nowIso}
    WHERE mutation_id = ${mutationId}
      AND deleted_at IS NULL
  `);
}
