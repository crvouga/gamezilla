import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Prune applied/rejected mutation log rows older than `olderThanMs`,
 * and acknowledged write_rejections past the same window.
 * Call from a scheduled server job (dev wipe / ops), not from client uploads.
 */
export async function pruneMutationArtifacts(
  db: Pick<SqlClient, 'run'>,
  olderThanMs: number,
  now: Date = new Date()
): Promise<void> {
  const cutoff = new Date(now.getTime() - olderThanMs).toISOString();
  await db.run(sql`
    DELETE FROM _mutations
    WHERE id IN (
      SELECT mutation_id FROM _mutations_applied
      WHERE applied_at < ${cutoff}
    )
  `);
  await db.run(sql`
    DELETE FROM write_rejections
    WHERE acknowledged = true
      AND created_at < ${cutoff}
  `);
}
