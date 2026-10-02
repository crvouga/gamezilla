/**
 * App-layer greedy match pass: claim → pair in JS → commit.
 *
 * @internal
 */

import type { AttributeState } from '@pkgs/attribute';
import { asKeywordRecord } from '@pkgs/keyword';
import type { FormulaWire, RadiusOptions } from '@pkgs/matchmaking/interface';
import { pairMatch, planGroups } from '@pkgs/matchmaking/shared';
import type { SqlClient } from '@pkgs/sql-client/interface';
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
};

export type RunClaimedMatchPassArgs = {
  readonly sqlClient: SqlClient;
  readonly partitionSignature: string;
  readonly groupSize: number;
  readonly maxPairsPerPass: number;
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
  };
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

  const nowIso = new Date(args.nowMs).toISOString();
  return args.sqlClient.transaction(async (tx) => {
    await tx.run(
      claimWaitingBatchQuery({
        claimToken,
        nowMs: args.nowMs,
        nowIso,
        partitionSignature: args.partitionSignature,
        groupSize: args.groupSize,
        limit: claimLimit,
        staleBeforeMs,
      })
    );
    const claimedRows = await tx.query(selectClaimedWaitingQuery(claimToken));
    if (claimedRows.length < args.groupSize) {
      await tx.run(clearClaimQuery({ claimToken, nowIso }));
      return 0;
    }
    const snapshot = claimedRows.map(toWaitingSnapshot);
    const groups = planGroups({
      candidates: snapshot,
      groupSize: args.groupSize,
      maxGroups: args.maxPairsPerPass,
      acceptsPair: (a, b) =>
        pairMatch({ a, b, nowMs: args.nowMs, globalRadius: args.radius }),
    });
    if (groups.length === 0) {
      await tx.run(clearClaimQuery({ claimToken, nowIso }));
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
            nowIso,
          })
        );
      }
    }
    await tx.run(deleteWaitingIdsQuery({ ids: matchedIds, nowIso }));
    await tx.run(clearClaimQuery({ claimToken, nowIso }));
    return groups.length;
  });
}
