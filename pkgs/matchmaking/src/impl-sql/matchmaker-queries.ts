/**
 * Portable SQL query builders for the matchmaking hot path.
 *
 * @internal
 */
import { type Sql, type SqlFragment, join, sql } from '@pkgs/sql';

import type {
  ClaimedWaitingRow,
  ParticipantRow,
  StatusRow,
} from './matchmaker-internals';

export type SchemaFingerprintRow = {
  readonly schema_fingerprint: string;
};

export type ActivePartitionRow = {
  readonly partition_signature: string;
  readonly group_size: number | string;
};

export function statusLookupQuery(participantId: string): Sql<StatusRow> {
  return sql<StatusRow>`
    SELECT
      'waiting' AS status,
      data,
      metadata,
      CAST(NULL AS TEXT) AS match_id,
      joined_at
    FROM matchmaking_waiting
    WHERE id = ${participantId}
    UNION ALL
    SELECT
      'matched' AS status,
      data,
      metadata,
      match_id,
      joined_at
    FROM matchmaking_matched
    WHERE id = ${participantId}
    LIMIT 1`;
}

export function statusPeersQuery(
  matchId: string,
  participantId: string
): Sql<ParticipantRow> {
  return sql<ParticipantRow>`
    SELECT id, joined_at, data, metadata
      FROM matchmaking_matched
     WHERE match_id = ${matchId} AND id <> ${participantId}
     ORDER BY joined_at`;
}

export function schemaFingerprintQuery(): Sql<SchemaFingerprintRow> {
  return sql<SchemaFingerprintRow>`
    SELECT schema_fingerprint
      FROM matchmaking_schema_state
     WHERE id = 1`;
}

export function activePartitionsQuery(
  maxPartitions: number
): Sql<ActivePartitionRow> {
  return sql<ActivePartitionRow>`
    SELECT partition_signature, group_size
      FROM matchmaking_active_partitions
     ORDER BY first_seen_at
     LIMIT ${maxPartitions}`;
}

export function prunePartitionsQuery(): SqlFragment {
  return sql<void>`
    DELETE FROM matchmaking_active_partitions AS ap
    WHERE NOT EXISTS (
       SELECT 1
         FROM matchmaking_waiting AS w
        WHERE w.partition_signature = ap.partition_signature
          AND w.group_size = ap.group_size
     )`;
}

export function releaseStaleClaimsQuery(args: {
  readonly nowMs: number;
  readonly claimTtlMs: number;
}): SqlFragment {
  const cutoff = args.nowMs - args.claimTtlMs;
  return sql<void>`
    UPDATE matchmaking_waiting
       SET claim_token = NULL, claimed_at = NULL
     WHERE claim_token IS NOT NULL
       AND claimed_at IS NOT NULL
       AND claimed_at < ${cutoff}`;
}

export function claimWaitingBatchQuery(args: {
  readonly claimToken: string;
  readonly nowMs: number;
  readonly partitionSignature: string;
  readonly groupSize: number;
  readonly limit: number;
  readonly staleBeforeMs: number;
}): SqlFragment {
  return sql<void>`
    UPDATE matchmaking_waiting
       SET claim_token = ${args.claimToken},
           claimed_at = ${args.nowMs}
     WHERE id IN (
       SELECT id FROM (
         SELECT id
           FROM matchmaking_waiting
          WHERE partition_signature = ${args.partitionSignature}
            AND group_size = ${args.groupSize}
            AND (
              claim_token IS NULL
              OR (claimed_at IS NOT NULL AND claimed_at < ${args.staleBeforeMs})
            )
          ORDER BY priority DESC, joined_at ASC
          LIMIT ${args.limit}
       ) AS candidates
     )`;
}

export function selectClaimedWaitingQuery(
  claimToken: string
): Sql<ClaimedWaitingRow> {
  return sql<ClaimedWaitingRow>`
    SELECT
      id,
      joined_at,
      data,
      formulas,
      metadata,
      primary_bucket,
      priority
    FROM matchmaking_waiting
    WHERE claim_token = ${claimToken}
    ORDER BY priority DESC, joined_at ASC`;
}

export function clearClaimQuery(claimToken: string): SqlFragment {
  return sql<void>`
    UPDATE matchmaking_waiting
       SET claim_token = NULL, claimed_at = NULL
     WHERE claim_token = ${claimToken}`;
}

export function deleteWaitingIdsQuery(ids: readonly string[]): SqlFragment {
  if (ids.length === 0) {
    return sql<void>`SELECT 1 WHERE 0`;
  }
  return sql<void>`
    DELETE FROM matchmaking_waiting
     WHERE id IN (${join(ids)})`;
}

export function insertMatchedRowQuery(args: {
  readonly id: string;
  readonly matchId: string;
  readonly joinedAt: number;
  readonly matchedAt: number;
  readonly dataJson: string;
  readonly metadataJson: string | null;
}): SqlFragment {
  return sql<void>`
    INSERT INTO matchmaking_matched (
      id, match_id, joined_at, matched_at, data, metadata
    ) VALUES (
      ${args.id},
      ${args.matchId},
      ${args.joinedAt},
      ${args.matchedAt},
      ${args.dataJson},
      ${args.metadataJson}
    )`;
}

export function sweepExpiredWaitingQuery(args: {
  readonly partitionSignature: string;
  readonly cutoffMs: number;
}): SqlFragment {
  return sql<void>`
    DELETE FROM matchmaking_waiting
     WHERE partition_signature = ${args.partitionSignature}
       AND joined_at < ${args.cutoffMs}
       AND claim_token IS NULL`;
}

export function sweepMatchedRowsQuery(cutoffMs: number): SqlFragment {
  return sql<void>`
    DELETE FROM matchmaking_matched
     WHERE matched_at < ${cutoffMs}`;
}
