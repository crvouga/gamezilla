import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { OwnerRequest } from '@pkgs/matchmaking-root-shared-ts/identity';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { parseJsonValue } from './matchmaker-internals';

export type OwnerRow = {
  readonly current_id: string | null;
  readonly available: boolean | number;
};

/** Acquires the same database row lock for commands, policy and formation. */
export async function lockOwner(
  tx: SqlTx,
  ownerId: string,
  iso: string
): Promise<OwnerRow> {
  assert.nonEmptyString(ownerId, 'matchmaking: ownerId required');
  const rows = await tx.query(sql<OwnerRow>`
    INSERT INTO matchmaking_owners (id, current_id, available, created_at, updated_at, deleted_at)
    VALUES (${ownerId}, ${null}, ${true}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO UPDATE SET updated_at = matchmaking_owners.updated_at
    RETURNING current_id, available`);
  assert.defined(rows[0], 'matchmaking: owner lock did not return a row');
  return rows[0];
}

export async function lockOwners(
  tx: SqlTx,
  owners: readonly string[],
  iso: string
): Promise<void> {
  for (const owner of [...new Set(owners)].sort())
    await lockOwner(tx, owner, iso);
}

export async function readReceipt<T>(
  tx: SqlTx,
  input: OwnerRequest,
  kind: string
): Promise<T | undefined> {
  assert.nonEmptyString(input.requestId, 'matchmaking: requestId required');
  const rows = await tx.query(sql<{ kind: string; result: unknown }>`
    SELECT kind, result FROM matchmaking_requests
    WHERE owner_id = ${input.ownerId} AND request_id = ${input.requestId}`);
  const row = rows[0];
  if (row === undefined) return undefined;
  assert.ok(
    row.kind === kind,
    'matchmaking: requestId belongs to a different command'
  );
  return parseJsonValue(row.result) as T;
}

export async function writeReceipt(
  tx: SqlTx,
  args: {
    readonly input: OwnerRequest;
    readonly kind: string;
    readonly result: unknown;
    readonly iso: string;
  }
): Promise<void> {
  await tx.run(sql<void>`
    INSERT INTO matchmaking_requests (id, owner_id, request_id, kind, result, created_at, updated_at, deleted_at)
    VALUES (${JSON.stringify([args.input.ownerId, args.input.requestId])}, ${args.input.ownerId},
      ${args.input.requestId}, ${args.kind}, ${JSON.stringify(args.result)}, ${args.iso}, ${args.iso}, ${null})`);
}

export async function changeAvailability(
  tx: SqlTx,
  args: {
    readonly ownerId: string;
    readonly available: boolean;
    readonly nowMs: number;
  }
): Promise<void> {
  const iso = new Date(args.nowMs).toISOString();
  await lockOwner(tx, args.ownerId, iso);
  await tx.run(sql<void>`UPDATE matchmaking_owners SET available = ${args.available}, updated_at = ${iso}
    WHERE id = ${args.ownerId}`);
  if (args.available) return;
  await tx.run(sql<void>`UPDATE matchmaking_waiting SET deleted_at = ${iso}, updated_at = ${iso}, ended_at = ${args.nowMs}
    WHERE owner_id = ${args.ownerId} AND deleted_at IS NULL`);
}

/** Change a complete roster while acquiring the same owner locks in sorted order. */
export async function changeAvailabilities(
  tx: SqlTx,
  args: {
    readonly ownerIds: readonly string[];
    readonly available: boolean;
    readonly nowMs: number;
  }
): Promise<void> {
  const owners = [...new Set(args.ownerIds)].sort();
  if (owners.length === 0) return;
  const iso = new Date(args.nowMs).toISOString();
  await lockOwners(tx, owners, iso);
  await tx.run(sql<void>`UPDATE matchmaking_owners SET available = ${args.available}, updated_at = ${iso}
    WHERE id IN (${join(owners)})`);
  if (args.available) return;
  await tx.run(sql<void>`UPDATE matchmaking_waiting SET deleted_at = ${iso}, updated_at = ${iso}, ended_at = ${args.nowMs}
    WHERE owner_id IN (${join(owners)}) AND deleted_at IS NULL`);
}

export async function changeRestriction(
  tx: SqlTx,
  args: {
    readonly ownerA: string;
    readonly ownerB: string;
    readonly restricted: boolean;
    readonly nowMs: number;
  }
): Promise<void> {
  const iso = new Date(args.nowMs).toISOString();
  const owners = [args.ownerA, args.ownerB].sort();
  const ownerA = owners[0]!;
  const ownerB = owners[1]!;
  await lockOwners(tx, owners, iso);
  await tx.run(sql<void>`
    INSERT INTO matchmaking_restrictions (id, owner_a, owner_b, restricted, created_at, updated_at, deleted_at)
    VALUES (${JSON.stringify(owners)}, ${ownerA}, ${ownerB}, ${args.restricted}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO UPDATE SET restricted = excluded.restricted, updated_at = excluded.updated_at`);
}
