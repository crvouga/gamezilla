/**
 * The rated puzzles a case's person already started, as consumption-ledger
 * rows placed on the day boundary itself: "started today" at exactly UTC
 * midnight of the case's day (the first instant that counts), "started before
 * today" one millisecond earlier (the last instant that does not). A window
 * off by one millisecond either way changes the count, so the boundary is
 * part of every case.
 *
 * For tests and spec bindings only (a `root/` export).
 */

import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { CaseInput } from './people';
import { countInput, DMN_INPUT } from './people';
import { ACTION } from './permission-catalog';

const DAY_MS = 86_400_000;

export type LedgerEntry = {
  readonly amount: number;
  /** ISO instant, as the server stamps it. */
  readonly consumed_at: string;
};

/** UTC midnight starting the day `nowMs` is in. */
export function utcMidnightOf(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS;
}

/** The case's started puzzles: today's at midnight, earlier ones 1 ms before. */
export function startedEntries(
  input: CaseInput,
  nowMs: number
): readonly LedgerEntry[] {
  const midnight = utcMidnightOf(nowMs);
  const entry = (atMs: number): LedgerEntry => ({
    amount: 1,
    consumed_at: new Date(atMs).toISOString(),
  });
  return [
    ...Array.from({ length: countInput(input, DMN_INPUT.today) }, () =>
      entry(midnight)
    ),
    ...Array.from({ length: countInput(input, DMN_INPUT.earlier) }, () =>
      entry(midnight - 1)
    ),
  ];
}

/** The same entries as synced ledger rows owned by `ownerId`. */
export async function insertStarted(
  db: SqlClient,
  args: {
    readonly ownerId: string;
    readonly entries: readonly LedgerEntry[];
  }
): Promise<void> {
  for (const [index, entry] of args.entries.entries()) {
    const id = `started-${String(index)}`;
    await db.run(sql`
      INSERT INTO permissions_quota_ledger (
        id, owner_id, quota, idempotency_key, amount, consumed_at,
        policy_version, created_at, updated_at, deleted_at
      ) VALUES (
        ${id}, ${args.ownerId}, ${ACTION.puzzleRatedSolve}, ${id},
        ${entry.amount}, ${entry.consumed_at}, ${'seeded'},
        ${entry.consumed_at}, ${entry.consumed_at}, ${null}
      )
    `);
  }
}
