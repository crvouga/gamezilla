import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

/**
 * The pools that have someone waiting, in one statement. A formation pass
 * costs several statements, so a caller with many pools asks this first and
 * passes only over the pools that can form a match. Same predicate as the
 * rows a pass reads.
 */
export async function waitingPartitions(
  tx: SqlTx,
  groupSize: number
): Promise<ReadonlySet<string>> {
  const rows = await tx.query(sql<{ partition_signature: string }>`
    SELECT DISTINCT w.partition_signature
      FROM matchmaking_waiting AS w JOIN matchmaking_owners AS o ON o.id = w.owner_id
     WHERE w.group_size = ${groupSize} AND w.deleted_at IS NULL
       AND o.available = ${true} AND o.current_id = w.id`);
  return new Set(rows.map((row) => row.partition_signature));
}
