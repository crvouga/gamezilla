/**
 * Portable SQL query builders for the matchmaking hot path.
 *
 * @internal
 */
import { join, type Sql, type SqlFragment, sql } from '@pkgs/sql';
import { MATCHMAKING_SCHEMA_STATE_ID } from './schema/tables';

export type SchemaFingerprintRow = {
  readonly schema_fingerprint: string;
};

export type ActivePartitionRow = {
  readonly partition_signature: string;
  readonly group_size: number | string;
};

export function schemaFingerprintQuery(): Sql<SchemaFingerprintRow> {
  return sql<SchemaFingerprintRow>`
    SELECT schema_fingerprint
      FROM matchmaking_schema_state
     WHERE id = ${MATCHMAKING_SCHEMA_STATE_ID}
       AND deleted_at IS NULL`;
}

export function activePartitionsQuery(
  maxPartitions: number
): Sql<ActivePartitionRow> {
  return sql<ActivePartitionRow>`
    SELECT partition_signature, group_size
      FROM matchmaking_active_partitions
     WHERE deleted_at IS NULL
     ORDER BY first_seen_at
     LIMIT ${maxPartitions}`;
}

export function prunePartitionsQuery(nowIso: string): SqlFragment {
  return sql<void>`
    UPDATE matchmaking_active_partitions AS ap
       SET deleted_at = ${nowIso},
           updated_at = ${nowIso}
     WHERE ap.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1
           FROM matchmaking_waiting AS w
          WHERE w.partition_signature = ap.partition_signature
            AND w.group_size = ap.group_size
            AND w.deleted_at IS NULL
       )`;
}

export function deleteWaitingIdsQuery(args: {
  readonly ids: readonly string[];
  readonly nowMs: number;
  readonly nowIso: string;
}): SqlFragment {
  if (args.ids.length === 0) {
    return sql<void>`SELECT 1 WHERE 0`;
  }
  return sql<void>`
    UPDATE matchmaking_waiting
       SET deleted_at = ${args.nowIso}, ended_at = ${args.nowMs},
           updated_at = ${args.nowIso}
     WHERE id IN (${join(args.ids)})
       AND deleted_at IS NULL`;
}

export function insertMatchedRowQuery(args: {
  readonly id: string;
  readonly matchId: string;
  readonly ownerId: string;
  readonly joinedAt: number;
  readonly matchedAt: number;
  readonly dataJson: string;
  readonly metadataJson: string | null;
  readonly nowIso: string;
}): SqlFragment {
  return sql<void>`
    INSERT INTO matchmaking_matched (
      id, owner_id, match_id, joined_at, matched_at, data, metadata,
      created_at, updated_at, deleted_at
    ) VALUES (
      ${args.id},
      ${args.ownerId},
      ${args.matchId},
      ${args.joinedAt},
      ${args.matchedAt},
      ${args.dataJson},
      ${args.metadataJson},
      ${args.nowIso},
      ${args.nowIso},
      ${null}
    )`;
}
