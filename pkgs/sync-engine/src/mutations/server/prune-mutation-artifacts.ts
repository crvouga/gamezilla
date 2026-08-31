import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Prune acknowledged sync_engine_write_rejections only.
 * Applied mutation ids in sync_engine_mutations_applied are retained for
 * idempotent replay — deleting them allows late retries to double-apply.
 */
export async function pruneMutationArtifacts(
  db: Pick<SqlClient, 'run'>,
  olderThanMs: number,
  now: Date
): Promise<void> {
  const cutoff = new Date(now.getTime() - olderThanMs).toISOString();
  await db.run(sql`
    DELETE FROM sync_engine_write_rejections
    WHERE acknowledged = true
      AND created_at < ${cutoff}
  `);
}
