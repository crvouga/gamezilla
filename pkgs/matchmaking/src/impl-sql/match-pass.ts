/**
 * App-layer greedy match pass: claim → pair in JS → commit.
 *
 * @internal
 */

import type { AttributeState } from '@pkgs/attribute';
import { asKeywordRecord } from '@pkgs/keyword';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { FormulaWire } from '../interface/formula-wire';
import type { RadiusOptions } from '../interface/types';
import { expandingRadius, pairMatch } from './matching';
import {
  type ClaimedWaitingRow,
  epochMs,
  parseJsonObject,
  parseJsonValue,
} from './matchmaker-internals';
import {
  claimWaitingBatchQuery,
  clearClaimQuery,
  deleteWaitingIdsQuery,
  insertMatchedRowQuery,
  selectClaimedWaitingQuery,
} from './matchmaker-queries';

type WaitingSnapshot = {
  readonly id: string;
  readonly joinedAtMs: number;
  readonly data: AttributeState;
  readonly formulas: readonly FormulaWire[];
  readonly metadata: Record<string, unknown> | null;
  readonly primaryBucket: number;
};

export type RunClaimedMatchPassArgs = {
  readonly sqlClient: SqlClient;
  readonly partitionSignature: string;
  readonly groupSize: number;
  readonly maxPairsPerPass: number;
  readonly bucketWidth: number;
  readonly radius: RadiusOptions;
  readonly claimTtlMs: number;
  readonly nowMs: number;
  readonly createId: () => string;
};

function toWaitingSnapshot(row: ClaimedWaitingRow): WaitingSnapshot {
  const data = asKeywordRecord(
    parseJsonObject(row.data, 'matchmaking waiting data'),
    'matchmaking waiting data'
  );
  const formulasRaw = parseJsonValue(row.formulas);
  const formulas = Array.isArray(formulasRaw)
    ? (formulasRaw as FormulaWire[])
    : [];
  const metadataRaw = parseJsonValue(row.metadata);
  const metadata =
    metadataRaw === null || metadataRaw === undefined
      ? null
      : (metadataRaw as Record<string, unknown>);
  return {
    id: row.id,
    joinedAtMs: epochMs(row.joined_at),
    data,
    formulas,
    metadata,
    primaryBucket: epochMs(row.primary_bucket),
  };
}

function compatibleWithGroup(
  group: readonly WaitingSnapshot[],
  cand: WaitingSnapshot,
  nowMs: number,
  radius: RadiusOptions
): boolean {
  return group.every((member) =>
    pairMatch({
      a: {
        data: member.data,
        formulas: member.formulas,
        joinedAtMs: member.joinedAtMs,
      },
      b: {
        data: cand.data,
        formulas: cand.formulas,
        joinedAtMs: cand.joinedAtMs,
      },
      nowMs,
      globalRadius: radius,
    })
  );
}

function tryBuildGroup(args: {
  readonly snapshot: readonly WaitingSnapshot[];
  readonly seedIndex: number;
  readonly groupSize: number;
  readonly taken: ReadonlySet<string>;
  readonly nowMs: number;
  readonly radius: RadiusOptions;
  readonly bucketWidth: number;
}): WaitingSnapshot[] | null {
  const { snapshot, seedIndex, groupSize, taken, nowMs, radius, bucketWidth } =
    args;
  const seed = snapshot[seedIndex];
  if (seed === undefined || taken.has(seed.id)) return null;
  const seedRadius = expandingRadius(seed.joinedAtMs, nowMs, radius);
  const ring = Math.ceil(seedRadius / Math.max(bucketWidth, 1));
  const group: WaitingSnapshot[] = [seed];
  for (let j = seedIndex + 1; j < snapshot.length; j += 1) {
    const cand = snapshot[j];
    if (cand === undefined || taken.has(cand.id)) continue;
    if (Math.abs(seed.primaryBucket - cand.primaryBucket) > ring) continue;
    if (!compatibleWithGroup(group, cand, nowMs, radius)) continue;
    group.push(cand);
    if (group.length === groupSize) return group;
  }
  return null;
}

function planGroups(args: {
  readonly snapshot: readonly WaitingSnapshot[];
  readonly groupSize: number;
  readonly maxPairs: number;
  readonly nowMs: number;
  readonly radius: RadiusOptions;
  readonly bucketWidth: number;
}): WaitingSnapshot[][] {
  const groups: WaitingSnapshot[][] = [];
  const taken = new Set<string>();
  for (let i = 0; i <= args.snapshot.length - args.groupSize; i += 1) {
    if (groups.length >= args.maxPairs) break;
    const group = tryBuildGroup({
      snapshot: args.snapshot,
      seedIndex: i,
      groupSize: args.groupSize,
      taken,
      nowMs: args.nowMs,
      radius: args.radius,
      bucketWidth: args.bucketWidth,
    });
    if (group === null) continue;
    for (const m of group) taken.add(m.id);
    groups.push(group);
  }
  return groups;
}

/**
 * One transactional match pass for a (partition, group_size) pair.
 * Returns the number of groups produced.
 */
export async function runClaimedMatchPass(
  args: RunClaimedMatchPassArgs
): Promise<number> {
  if (args.groupSize < 2 || args.maxPairsPerPass <= 0) return 0;
  const claimToken = args.createId();
  const claimLimit = args.maxPairsPerPass * args.groupSize * 4;
  const staleBeforeMs = args.nowMs - args.claimTtlMs;

  return args.sqlClient.transaction(async (tx) => {
    await tx.run(
      claimWaitingBatchQuery({
        claimToken,
        nowMs: args.nowMs,
        partitionSignature: args.partitionSignature,
        groupSize: args.groupSize,
        limit: claimLimit,
        staleBeforeMs,
      })
    );
    const claimedRows = await tx.query(selectClaimedWaitingQuery(claimToken));
    if (claimedRows.length < args.groupSize) {
      await tx.run(clearClaimQuery(claimToken));
      return 0;
    }
    const snapshot = claimedRows.map(toWaitingSnapshot);
    const groups = planGroups({
      snapshot,
      groupSize: args.groupSize,
      maxPairs: args.maxPairsPerPass,
      nowMs: args.nowMs,
      radius: args.radius,
      bucketWidth: args.bucketWidth,
    });
    if (groups.length === 0) {
      await tx.run(clearClaimQuery(claimToken));
      return 0;
    }
    const matchedIds: string[] = [];
    for (const group of groups) {
      const matchId = args.createId();
      for (const member of group) {
        matchedIds.push(member.id);
        await tx.run(
          insertMatchedRowQuery({
            id: member.id,
            matchId,
            joinedAt: member.joinedAtMs,
            matchedAt: args.nowMs,
            dataJson: JSON.stringify(member.data),
            metadataJson:
              member.metadata === null ? null : JSON.stringify(member.metadata),
          })
        );
      }
    }
    await tx.run(deleteWaitingIdsQuery(matchedIds));
    await tx.run(clearClaimQuery(claimToken));
    return groups.length;
  });
}
