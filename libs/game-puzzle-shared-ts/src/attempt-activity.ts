import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';

/** Causal activity stays ordered even when several choices share a clock instant. */
export async function nextAttemptActivity(
  tx: MutationDb,
  ownerId: string
): Promise<number> {
  const rows = await tx.query(sql<{ latest: number | null }>`
    SELECT MAX(activity_order) AS latest FROM puzzle_content_attempts WHERE owner_id = ${ownerId}
  `);
  return (rows[0]?.latest ?? 0) + 1;
}
