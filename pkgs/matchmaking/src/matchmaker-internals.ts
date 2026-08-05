/**
 * Internal types and tiny helpers for the {@link Matchmaker} engine.
 * Split out of `matchmaker.ts` purely to keep that file under the
 * per-file line cap. Nothing here is part of the public API.
 *
 * @internal
 */

import { assert } from '@pkgs/assert';
import { asKeywordRecord } from '@pkgs/keyword';
import type { FormulaWire } from './formula-wire';
import type { MatchedParticipant, ParticipantStatus } from './types';

export type StatusRow = {
  readonly status: ParticipantStatus;
  readonly data: Record<string, unknown>;
  readonly metadata: Record<string, unknown> | null;
  readonly match_id: string | null;
};

export type ParticipantRow = {
  readonly id: string;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
  readonly metadata: Record<string, unknown> | null;
};

export type MatchPassRow = {
  readonly match_id: string;
  readonly participant_id: string;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
  readonly metadata: Record<string, unknown> | null;
};

export type RunMatchPassesOptions = {
  readonly maxPasses?: number;
  readonly groupSize?: number;
  readonly signal?: AbortSignal;
};

/**
 * A (signature, group_size) pair pulled from
 * `matchmaking_active_partitions`. The drain fans out one task per
 * pair because different group sizes never cross-match (the SQL
 * `matchmaking_run_match_pass` filters on `group_size` as part of
 * its candidate snapshot).
 */
export type ActivePartition = {
  readonly partitionSignature: string;
  readonly groupSize: number;
};

export type RunMatchPassesResult = {
  readonly matches: number;
  readonly passes: number;
};

export type SweepExpiredResult = {
  readonly removed: number;
};

export type SweepMatchedResult = {
  readonly removed: number;
};

export type RunMatchPassesAcrossPartitionsOptions = {
  readonly maxPartitions?: number;
  readonly maxPassesPerPartition?: number;
  /** Bounded JS-side concurrency for partition drains. Default 8. */
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
};

export type RunMatchPassesAcrossPartitionsResult = {
  readonly matches: number;
  readonly passes: number;
  readonly partitions: number;
};

export type SweepExpiredAcrossPartitionsOptions = {
  readonly maxPartitions?: number;
  /** Bounded JS-side concurrency for partition sweeps. Default 8. */
  readonly concurrency?: number;
};

export type SweepExpiredAcrossPartitionsResult = {
  readonly removed: number;
  readonly partitions: number;
};

/**
 * Wire-shaped formulas-only payload for {@link Matchmaker.updateFormulasRaw}.
 */
export type UpdateFormulasInputRaw = {
  readonly formulas: readonly FormulaWire[];
};

export function rowToParticipant(row: ParticipantRow): MatchedParticipant {
  const data = asKeywordRecord(row.data, 'matchmaking peer data');
  return {
    participantId: row.id,
    joinedAt: row.joined_at,
    data,
    metadata: row.metadata,
  };
}

export function assertPartitionSignature(
  signature: string,
  label: string
): void {
  assert.ok(
    typeof signature === 'string',
    `${label}: partitionSignature must be a string`,
    { signature }
  );
}

/**
 * Validates the numeric invariants on options passed to the
 * Matchmaker constructor. Centralised so the constructor body stays
 * within the per-function line cap.
 */
export function assertMatchmakerOptionInvariants(opts: {
  readonly maxPairsPerPass: number;
  readonly bucketWidth: number;
  readonly matchedRetentionSeconds: number;
}): void {
  assert.ok(
    Number.isFinite(opts.maxPairsPerPass) && opts.maxPairsPerPass > 0,
    'Matchmaker: maxPairsPerPass must be a positive finite number',
    { maxPairsPerPass: opts.maxPairsPerPass }
  );
  assert.ok(
    Number.isFinite(opts.bucketWidth) && opts.bucketWidth > 0,
    'Matchmaker: bucketWidth must be a positive finite number',
    { bucketWidth: opts.bucketWidth }
  );
  assert.ok(
    Number.isFinite(opts.matchedRetentionSeconds) &&
      opts.matchedRetentionSeconds >= 0,
    'Matchmaker: matchedRetentionSeconds must be a non-negative finite number',
    { matchedRetentionSeconds: opts.matchedRetentionSeconds }
  );
}
