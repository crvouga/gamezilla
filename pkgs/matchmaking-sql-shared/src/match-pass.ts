import type { AttributeState } from '@pkgs/attribute-shared/attribute';
import { asKeywordRecord } from '@pkgs/keyword-shared/keyword';
import { pairMatch } from '@pkgs/matchmaking-root-shared/compatibility';
import type { FormulaWire } from '@pkgs/matchmaking-root-shared/formula-wire';
import { planGroups } from '@pkgs/matchmaking-root-shared/groups';
import type { RadiusOptions } from '@pkgs/matchmaking-root-shared/types';
import type { SqlClient, SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { WaitingRow } from './matchmaker-internals';
import {
  epochMs,
  parseJsonObject,
  parseJsonValue,
} from './matchmaker-internals';
import {
  deleteWaitingIdsQuery,
  insertMatchedRowQuery,
} from './matchmaker-queries';
import { lockOwners } from './owner-repository';
import { lockPartition } from './partition-lock';
import { matchmakingTransaction } from './transaction';

export type FormedParticipant = {
  readonly id: string;
  readonly ownerId: string;
  readonly joinedAtMs: number;
  readonly data: AttributeState;
  readonly metadata: Record<string, unknown> | null;
};

type WaitingSnapshot = FormedParticipant & {
  readonly formulas: readonly FormulaWire[];
};

export type MatchFormation = {
  readonly matchId: string;
  readonly participants: readonly FormedParticipant[];
};

export type FormationPorts = {
  readonly partitionSignature: string;
  readonly groupSize: number;
  readonly maxPairsPerPass: number;
  readonly radius: RadiusOptions;
  readonly nowMs: number;
  readonly createId: () => string;
  /** Consumer-owned restrictions, read after the participating owners are locked. */
  readonly restrictionsFor?: (
    tx: SqlTx,
    owners: readonly string[]
  ) => Promise<readonly (readonly [string, string])[]>;
  /** A failure rolls back the whole formation, including the consuming handoff. */
  readonly onFormed?: (tx: SqlTx, formation: MatchFormation) => Promise<void>;
};

function toWaitingSnapshot(row: WaitingRow): WaitingSnapshot {
  return {
    id: row.id,
    ownerId: row.owner_id,
    joinedAtMs: epochMs(row.joined_at),
    data: asKeywordRecord(
      parseJsonObject(row.data, 'matchmaking waiting data'),
      'matchmaking waiting data'
    ),
    formulas: parseJsonValue(row.formulas) as readonly FormulaWire[],
    metadata: (parseJsonValue(row.metadata) ?? null) as Record<
      string,
      unknown
    > | null,
  };
}

async function waitingRows(
  tx: SqlTx,
  args: FormationPorts
): Promise<WaitingRow[]> {
  return tx.query(sql<WaitingRow>`SELECT w.id, w.owner_id, w.joined_at, w.data, w.formulas, w.metadata
    FROM matchmaking_waiting AS w JOIN matchmaking_owners AS o ON o.id = w.owner_id
    WHERE w.partition_signature = ${args.partitionSignature} AND w.group_size = ${args.groupSize}
      AND w.deleted_at IS NULL AND o.available = ${true} AND o.current_id = w.id
    ORDER BY w.accepted_order ASC`);
}

async function restrictedPairs(
  tx: SqlTx,
  args: FormationPorts,
  owners: readonly string[]
): Promise<Set<string>> {
  const rows = await tx.query(sql<{ owner_a: string; owner_b: string }>`
    SELECT r.owner_a, r.owner_b FROM matchmaking_restrictions AS r
    JOIN matchmaking_waiting AS a ON a.owner_id = r.owner_a AND a.deleted_at IS NULL
    JOIN matchmaking_waiting AS b ON b.owner_id = r.owner_b AND b.deleted_at IS NULL
    WHERE r.restricted = ${true} AND r.deleted_at IS NULL
      AND a.partition_signature = ${args.partitionSignature} AND a.group_size = ${args.groupSize}
      AND b.partition_signature = ${args.partitionSignature} AND b.group_size = ${args.groupSize}`);
  const facts = (await args.restrictionsFor?.(tx, owners)) ?? [];
  return new Set(
    [...rows.map((r) => [r.owner_a, r.owner_b]), ...facts].map((pair) =>
      JSON.stringify([...pair].sort())
    )
  );
}

async function commitGroup(
  tx: SqlTx,
  args: FormationPorts,
  group: readonly WaitingSnapshot[]
): Promise<void> {
  const matchId = args.createId();
  const nowIso = new Date(args.nowMs).toISOString();
  for (const member of group) {
    await tx.run(
      insertMatchedRowQuery({
        id: member.id,
        ownerId: member.ownerId,
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
  await tx.run(
    deleteWaitingIdsQuery({
      ids: group.map((p) => p.id),
      nowIso,
      nowMs: args.nowMs,
    })
  );
  await args.onFormed?.(tx, { matchId, participants: group });
}

/** Every entry point locks the pool before owners, and owners in the same order. */
export async function formMatches(
  tx: SqlTx,
  args: FormationPorts
): Promise<number> {
  await lockPartition(tx, {
    signature: args.partitionSignature,
    groupSize: args.groupSize,
    nowMs: args.nowMs,
  });
  const candidates = await waitingRows(tx, args);
  await lockOwners(
    tx,
    candidates.map((r) => r.owner_id),
    new Date(args.nowMs).toISOString()
  );
  const snapshot = (await waitingRows(tx, args)).map(toWaitingSnapshot);
  const restricted = await restrictedPairs(
    tx,
    args,
    snapshot.map((r) => r.ownerId)
  );
  const groups = planGroups({
    candidates: snapshot,
    groupSize: args.groupSize,
    maxGroups: args.maxPairsPerPass,
    acceptsPair: (a, b) =>
      a.ownerId !== b.ownerId &&
      !restricted.has(JSON.stringify([a.ownerId, b.ownerId].sort())) &&
      pairMatch({ a, b, nowMs: args.nowMs, globalRadius: args.radius }),
  });
  for (const group of groups) await commitGroup(tx, args, group);
  return groups.length;
}

export async function runFormation(
  args: FormationPorts & { readonly sqlClient: SqlClient }
): Promise<number> {
  return matchmakingTransaction(args.sqlClient, (tx) => formMatches(tx, args));
}
