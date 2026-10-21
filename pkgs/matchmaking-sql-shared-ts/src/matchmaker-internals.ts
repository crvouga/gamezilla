/**
 * Internal types and tiny helpers for the {@link Matchmaker} engine.
 *
 * @internal
 */

import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { asKeywordRecord } from '@pkgs/keyword-shared-ts/keyword';
import type { FormulaWire } from '@pkgs/matchmaking-root-shared-ts/formula-wire';
import type { MatchedParticipant } from '@pkgs/matchmaking-root-shared-ts/types';
export type ParticipantRow = {
  readonly id: string;
  readonly joined_at: number | string;
  readonly data: unknown;
  readonly metadata: unknown;
};

export type WaitingRow = {
  readonly id: string;
  readonly joined_at: number | string;
  readonly data: unknown;
  readonly formulas: unknown;
  readonly metadata: unknown;
  readonly owner_id: string;
};

export type RunMatchPassesOptions = {
  readonly maxPasses?: number;
  readonly groupSize?: number;
  readonly signal?: AbortSignal;
};

export type ActivePartition = {
  readonly partitionSignature: string;
  readonly groupSize: number;
};

export type RunMatchPassesResult = {
  readonly matches: number;
  readonly passes: number;
};

export type RunMatchPassesAcrossPartitionsOptions = {
  readonly maxPartitions?: number;
  readonly maxPassesPerPartition?: number;
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
};

export type RunMatchPassesAcrossPartitionsResult = {
  readonly matches: number;
  readonly passes: number;
  readonly partitions: number;
};

export type UpdateFormulasInputRaw = {
  readonly formulas: readonly FormulaWire[];
};

export function epochMs(value: number | string): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  assert.ok(Number.isFinite(n), 'matchmaking: invalid epoch ms', { value });
  return n;
}

export function parseJsonObject(
  value: unknown,
  label: string
): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    assert.record(parsed, `${label} must be a JSON object`);
    return parsed;
  }
  assert.record(value, `${label} must be an object`);
  return value;
}

export function parseJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

export function rowToParticipant(row: ParticipantRow): MatchedParticipant {
  const dataRaw = parseJsonObject(row.data, 'matchmaking peer data');
  const data = asKeywordRecord(dataRaw, 'matchmaking peer data');
  const metadataRaw = parseJsonValue(row.metadata);
  let metadata: Record<string, unknown> | null = null;
  if (metadataRaw !== null && metadataRaw !== undefined) {
    assert.record(metadataRaw, 'matchmaking peer metadata');
    metadata = metadataRaw;
  }
  return {
    participantId: row.id,
    joinedAt: new Date(epochMs(row.joined_at)),
    data,
    metadata,
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

export function assertMatchmakerOptionInvariants(opts: {
  readonly maxPairsPerPass: number;
  readonly bucketWidth: number;
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
}
