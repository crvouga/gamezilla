import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { managedUpdatedAtIso } from '../shared/managed-columns';

/**
 * Soft-delete acknowledged sync_engine_write_rejections past retention.
 * Applied mutation ids in sync_engine_mutations_applied are retained for
 * idempotent replay — deleting them allows late retries to double-apply.
 */
export async function pruneMutationArtifacts(
  db: Pick<SqlClient, 'run'>,
  olderThanMs: number,
  now: Date
): Promise<void> {
  const cutoff = new Date(now.getTime() - olderThanMs).toISOString();
  const updatedAt = managedUpdatedAtIso(() => now.getTime());
  await db.run(sql`
    UPDATE sync_engine_write_rejections
    SET deleted_at = ${updatedAt}, updated_at = ${updatedAt}
    WHERE acknowledged = ${1}
      AND deleted_at IS NULL
      AND created_at < ${cutoff}
  `);
}
