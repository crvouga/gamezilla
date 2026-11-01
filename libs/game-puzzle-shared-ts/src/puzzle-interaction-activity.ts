import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';

/** Preserve causal play order even when several interactions share an instant. */
export async function nextPuzzleInteractionActivity(
  tx: MutationDb,
  ownerId: string
): Promise<number> {
  const rows = await tx.query(sql<{ latest: number | null }>`
    SELECT MAX(activity_order) AS latest FROM chess_puzzle_interactions WHERE owner_id = ${ownerId}
  `);
  return (rows[0]?.latest ?? 0) + 1;
}
