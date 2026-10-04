import { assert } from '@pkgs/assert-shared/singleton';
import type { InsertJoinAttrs } from '@pkgs/matchmaking-shared/join-helpers';
import type { JoinInputRaw } from '@pkgs/matchmaking-shared/matchmaking';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';
import { activePartitionId } from './tables';

export type InsertSearch = {
  readonly input: JoinInputRaw;
  readonly attrs: InsertJoinAttrs;
  readonly participantId: string;
  readonly signature: string;
  readonly nowMs: number;
  readonly rating: number;
  readonly bucket: number;
};

export async function insertSearch(
  tx: SqlTx,
  args: InsertSearch
): Promise<void> {
  const iso = new Date(args.nowMs).toISOString();
  const partitionId = activePartitionId(args.signature, args.attrs.groupSize);
  const sequence = await tx.query(sql<{ accepted_count: number }>`
    INSERT INTO matchmaking_active_partitions
      (id, partition_signature, group_size, first_seen_at, accepted_count, created_at, updated_at, deleted_at)
    VALUES (${partitionId}, ${args.signature}, ${args.attrs.groupSize}, ${args.nowMs}, ${1}, ${iso}, ${iso}, ${null})
    ON CONFLICT (partition_signature, group_size) DO UPDATE SET
      accepted_count = COALESCE(matchmaking_active_partitions.accepted_count, 0) + 1,
      deleted_at = NULL, updated_at = excluded.updated_at
    RETURNING accepted_count`);
  assert.defined(sequence[0], 'matchmaking: accepted order missing');
  await tx.run(sql<void>`
    INSERT INTO matchmaking_waiting
      (id, owner_id, accepted_order, joined_at, data, formulas, partition_signature,
        group_size, metadata, primary_rating, primary_bucket, created_at, updated_at, deleted_at)
    VALUES (${args.participantId}, ${args.input.ownerId}, ${sequence[0].accepted_count}, ${args.nowMs},
      ${JSON.stringify(args.input.data)}, ${JSON.stringify(args.input.formulas)}, ${args.signature},
      ${args.attrs.groupSize}, ${args.attrs.metadata === null ? null : JSON.stringify(args.attrs.metadata)},
      ${args.rating}, ${args.bucket}, ${iso}, ${iso}, ${null})`);
  await tx.run(sql<void>`UPDATE matchmaking_owners SET current_id = ${args.participantId}, updated_at = ${iso}
    WHERE id = ${args.input.ownerId}`);
}
