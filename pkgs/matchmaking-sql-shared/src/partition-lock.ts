import sql from '@pkgs/sql-shared/sql';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import { activePartitionId } from './tables';

export async function lockPartition(
  tx: SqlTx,
  args: {
    readonly signature: string;
    readonly groupSize: number;
    readonly nowMs: number;
  }
): Promise<void> {
  const iso = new Date(args.nowMs).toISOString();
  await tx.run(sql<void>`INSERT INTO matchmaking_active_partitions
    (id, partition_signature, group_size, first_seen_at, accepted_count, created_at, updated_at, deleted_at)
    VALUES (${activePartitionId(args.signature, args.groupSize)}, ${args.signature}, ${args.groupSize},
      ${args.nowMs}, ${0}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO UPDATE SET updated_at = matchmaking_active_partitions.updated_at`);
}
