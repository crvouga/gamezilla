import { asKeywordRecord } from '@pkgs/keyword-shared/keyword';
import { pairMatch } from '@pkgs/matchmaking-root-shared/compatibility';
import type { FormulaWire } from '@pkgs/matchmaking-root-shared/formula-wire';
import type { RadiusOptions } from '@pkgs/matchmaking-root-shared/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { FormationPorts } from './match-pass';
import {
  epochMs,
  parseJsonObject,
  parseJsonValue,
} from './matchmaker-internals';
import { lockOwners } from './owner-repository';

type PairRow = {
  owner_id: string;
  data: unknown;
  formulas: unknown;
  joined_at: number | string;
  partition_signature: string;
  group_size: number | string;
};

export async function canPair(
  tx: SqlTx,
  args: {
    readonly ownerA: string;
    readonly ownerB: string;
    readonly radius: RadiusOptions;
    readonly nowMs: number;
    readonly restrictionsFor: FormationPorts['restrictionsFor'];
  }
): Promise<boolean> {
  if (args.ownerA === args.ownerB) return false;
  await lockOwners(
    tx,
    [args.ownerA, args.ownerB],
    new Date(args.nowMs).toISOString()
  );
  const facts =
    (await args.restrictionsFor?.(tx, [args.ownerA, args.ownerB])) ?? [];
  if (
    facts.some(
      (pair) => pair.includes(args.ownerA) && pair.includes(args.ownerB)
    )
  )
    return false;
  const rows =
    await tx.query(sql<PairRow>`SELECT w.owner_id, w.data, w.formulas, w.joined_at,
    w.partition_signature, w.group_size FROM matchmaking_waiting AS w
    JOIN matchmaking_owners AS o ON o.current_id = w.id AND o.id = w.owner_id
    WHERE (o.id = ${args.ownerA} OR o.id = ${args.ownerB}) AND o.available = ${true} AND w.deleted_at IS NULL`);
  if (rows.length !== 2) return false;
  const a = rows[0]!;
  const b = rows[1]!;
  if (
    a.partition_signature !== b.partition_signature ||
    epochMs(a.group_size) !== epochMs(b.group_size)
  )
    return false;
  const blocked = await tx.query(sql<{
    id: string;
  }>`SELECT id FROM matchmaking_restrictions
    WHERE id = ${JSON.stringify([args.ownerA, args.ownerB].sort())} AND restricted = ${true} AND deleted_at IS NULL`);
  if (blocked.length > 0) return false;
  const side = (row: PairRow) => ({
    data: asKeywordRecord(
      parseJsonObject(row.data, 'matchmaking pair data'),
      'matchmaking pair data'
    ),
    formulas: parseJsonValue(row.formulas) as readonly FormulaWire[],
    joinedAtMs: epochMs(row.joined_at),
  });
  return pairMatch({
    a: side(a),
    b: side(b),
    nowMs: args.nowMs,
    globalRadius: args.radius,
  });
}
