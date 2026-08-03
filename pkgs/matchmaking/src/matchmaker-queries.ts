/**
 * SQL query builders for the matchmaking hot path.
 *
 * These are pure functions returning typed `Sql` — no I/O, no connection. They
 * live alongside `matchmaker.ts` (which composes them into `SqlClient` calls)
 * to keep that file within the Tiger-Style size cap while every queue statement
 * stays a single, inspectable SQL query.
 *
 * @internal
 */
import { sql, type Sql, type SqlFragment } from '@pkgs/sql';

import type {
  MatchPassRow,
  ParticipantRow,
  StatusRow,
} from './matchmaker-internals';

export type SweepExpiredCountRow = {
  readonly matchmaking_sweep_expired: number | string;
};

export type SweepMatchedCountRow = {
  readonly matchmaking_sweep_matched: number | string;
};

export type SchemaFingerprintRow = {
  readonly schema_fingerprint: string;
};

export type ActivePartitionRow = {
  readonly partition_signature: string;
  readonly group_size: number | string;
};

/**
 * Single-statement read across the waiting + matched tables via UNION ALL with
 * a trailing LIMIT 1 binding to the whole compound.
 */
export function statusLookupQuery(participantId: string): Sql<StatusRow> {
  return sql<StatusRow>`
    SELECT 'waiting'::text AS status, data, metadata, NULL::uuid AS match_id
      FROM matchmaking_waiting
     WHERE id = ${participantId}
    UNION ALL
    SELECT 'matched'::text AS status, data, metadata, match_id
      FROM matchmaking_matched
     WHERE id = ${participantId}
    LIMIT 1`;
}

export type RunMatchPassArgs = {
  readonly partitionSignature: string;
  readonly baseRadius: number;
  readonly radiusGrowthPerSecond: number;
  readonly maxRadius: number;
  readonly maxPairsPerPass: number;
  readonly bucketWidth: number;
  readonly groupSize: number;
  readonly nowParam: string | null;
};

/** Set-returning `matchmaking_run_match_pass(...)` call in FROM position. */
export function runMatchPassQuery(args: RunMatchPassArgs): Sql<MatchPassRow> {
  return sql<MatchPassRow>`
    SELECT match_id, participant_id, joined_at, data
      FROM matchmaking_run_match_pass(
        ${args.partitionSignature},
        ${args.baseRadius},
        ${args.radiusGrowthPerSecond},
        ${args.maxRadius},
        ${args.maxPairsPerPass},
        ${args.bucketWidth},
        ${args.groupSize},
        ${args.nowParam}
      ) AS t`;
}

/** Prune `(sig, group_size)` pairs with no remaining waiters (aliased DELETE). */
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

/** `matchmaking_sweep_expired(sig, maxWaitSeconds, now)` scalar call. */
export function sweepExpiredQuery(args: {
  readonly partitionSignature: string;
  readonly maxWaitSeconds: number;
  readonly nowParam: string | null;
}): Sql<SweepExpiredCountRow> {
  return sql<SweepExpiredCountRow>`
    SELECT matchmaking_sweep_expired(
      ${args.partitionSignature},
      ${args.maxWaitSeconds},
      ${args.nowParam}
    ) AS matchmaking_sweep_expired`;
}

/** `matchmaking_sweep_matched(retentionSeconds, now)` scalar call. */
export function sweepMatchedQuery(args: {
  readonly matchedRetentionSeconds: number;
  readonly nowParam: string | null;
}): Sql<SweepMatchedCountRow> {
  return sql<SweepMatchedCountRow>`
    SELECT matchmaking_sweep_matched(
      ${args.matchedRetentionSeconds},
      ${args.nowParam}
    ) AS matchmaking_sweep_matched`;
}

/** Peer participants sharing a `match_id`, excluding the caller. */
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

/** Installed schema fingerprint row (id = 1). */
export function schemaFingerprintQuery(): Sql<SchemaFingerprintRow> {
  return sql<SchemaFingerprintRow>`
    SELECT schema_fingerprint
      FROM matchmaking_schema_state
     WHERE id = 1`;
}

/** Active `(partition_signature, group_size)` pairs, oldest first, capped. */
export function activePartitionsQuery(cap: number): Sql<ActivePartitionRow> {
  return sql<ActivePartitionRow>`
    SELECT partition_signature, group_size
      FROM matchmaking_active_partitions
     ORDER BY first_seen_at
     LIMIT ${cap}`;
}
