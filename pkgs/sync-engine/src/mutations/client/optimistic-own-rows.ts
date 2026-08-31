import { assert } from '@pkgs/assert';
import { bulk, ident, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  FRAMEWORK_TABLE_NAMES,
  SYNC_ENGINE_OPTIMISTIC_PEER_ROWS,
} from '../../shared/framework-server-ddl';
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
  capture: WriteCaptureSnapshot
): Promise<void> {
  for (const [table, ids] of Object.entries(capture.ids)) {
    if (FRAMEWORK_TABLE_SET.has(table)) continue;
    assertTableName(table);
    const unique = [...new Set(ids.filter((id) => id.length > 0))];
    if (unique.length === 0) continue;
    // 3 binds per row (table_name, row_id, mutation_id).
    const maxRows = Math.max(1, Math.floor(MAX_SQLITE_VARS / 3));
    for (let offset = 0; offset < unique.length; offset += maxRows) {
      const chunk = unique.slice(offset, offset + maxRows);
      const data = chunk.map((id) => [table, id, mutationId] as const);
      await tx.run(sql`
        INSERT INTO ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
          (table_name, row_id, mutation_id)
        VALUES ${bulk(data)}
        ON CONFLICT (table_name, row_id) DO UPDATE SET
          mutation_id = excluded.mutation_id
      `);
    }
  }
}

/** Drop own markers after the server applied this mutation (row is real). */
export async function clearOptimisticRowsForMutation(
  tx: SqlClient,
  mutationId: string
): Promise<void> {
  await tx.run(sql`
    DELETE FROM ${ident(SYNC_ENGINE_OPTIMISTIC_PEER_ROWS)}
    WHERE mutation_id = ${mutationId}
  `);
}
