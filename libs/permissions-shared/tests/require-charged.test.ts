/**
 * `requireChargedInMutation`: the result of a quota-charged action needs its
 * charge (on any day), unless the actor has no limit. It reads the synced
 * ledger and policy only, so the device's optimistic apply and the server's
 * replay answer alike.
 */
import { describe, expect, test } from 'bun:test';
import { QUOTA_NOT_CHARGED, requireChargedInMutation } from '@libs/permissions-shared/mutation-permission';
import { ACTION } from '@libs/permissions-shared/permission-catalog';
import { CASE_NOW_MS, DMN_INPUT } from '@libs/permissions-shared/people';
import type { Person } from '@libs/permissions-shared/people';
import { mutationEnvFor, openConformanceDb, seedAccess } from '@libs/permissions-shared/world';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import sql from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

/** Shape of billing's synced table (the resolver reads it; billing owns it). */
const billingSubscriptionsFixture = defineTable({
  domain: 'billing',
  name: 'billing_subscriptions',
  columns: {
    account_id: 'text',
    provider: 'text',
    provider_subscription_id: 'text',
    price_key: 'text',
    status: 'text',
    current_period_end: 'timestamp',
    cancel_at_period_end: 'boolean',
  },
});

const DAY_MS = 86_400_000;
const LIMIT = 20;
const PREFIX = `${ACTION.puzzleRatedSolve}:p1:`;

type Charge = {
  readonly key: string;
  readonly atMs: number;
  readonly deleted?: boolean;
};

async function world(person: Person): Promise<SqlClient> {
  const db = await openConformanceDb([billingSubscriptionsFixture]);
  await seedAccess(db, {
    input: { [DMN_INPUT.who]: person },
    nowMs: CASE_NOW_MS,
  });
  return db;
}

async function charge(
  db: SqlClient,
  owner: string,
  row: Charge
): Promise<void> {
  const at = new Date(row.atMs).toISOString();
  await db.run(sql`
    INSERT INTO permissions_quota_ledger (
      id, owner_id, quota, idempotency_key, amount, consumed_at,
      policy_version, created_at, updated_at, deleted_at
    ) VALUES (
      ${`row-${row.key}`}, ${owner}, ${ACTION.puzzleRatedSolve}, ${row.key},
      ${1}, ${at}, ${'seeded'}, ${at}, ${at}, ${row.deleted === true ? at : null}
    )
  `);
}

/** Today's other puzzles, `count` of them charged at noon. */
function othersToday(count: number): readonly Charge[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `${ACTION.puzzleRatedSolve}:other-${String(i)}:today`,
    atMs: CASE_NOW_MS,
  }));
}

/** The refusal code, or null when the result may be recorded. */
async function verdict(
  person: Person,
  charges: readonly Charge[]
): Promise<{ readonly code: string | null; readonly meta: unknown }> {
  const db = await world(person);
  const env = mutationEnvFor(person, CASE_NOW_MS);
  try {
    for (const row of charges) await charge(db, env.actorId, row);
    const { tx } = wrapMutationDb(db, env);
    await requireChargedInMutation(
      { tx, env },
      { quota: ACTION.puzzleRatedSolve, keyPrefix: PREFIX }
    );
    return { code: null, meta: undefined };
  } catch (error) {
    if (!(error instanceof MutationError)) throw error;
    return { code: error.code, meta: error.meta };
  } finally {
    await db.disconnect();
  }
}

describe('requireChargedInMutation', () => {
  test('a charge for the action passes, even with the quota used up', async () => {
    const charges = [{ key: `${PREFIX}today`, atMs: CASE_NOW_MS }];
    expect((await verdict('guest', charges)).code).toBeNull();
    expect(
      (await verdict('guest', [...charges, ...othersToday(LIMIT)])).code
    ).toBeNull();
  });

  test("a charge from before today's window counts", async () => {
    const charges = [
      { key: `${PREFIX}yesterday`, atMs: CASE_NOW_MS - DAY_MS },
      ...othersToday(LIMIT),
    ];
    expect((await verdict('guest', charges)).code).toBeNull();
  });

  test('no charge while one more is allowed: not charged', async () => {
    expect((await verdict('guest', [])).code).toBe(QUOTA_NOT_CHARGED);
  });

  test('no charge with the quota used up: the quota decision refuses', async () => {
    const refused = await verdict('guest', othersToday(LIMIT));
    expect(refused.code).toBe('quota_exhausted');
    expect(refused.meta).toMatchObject({
      decision: { allowed: false, reason: 'quota_exhausted' },
    });
  });

  test('another action whose id extends this one is not its charge', async () => {
    const charges = [
      { key: `${ACTION.puzzleRatedSolve}:p10:today`, atMs: CASE_NOW_MS },
    ];
    expect((await verdict('guest', charges)).code).toBe(QUOTA_NOT_CHARGED);
  });

  test('a removed charge does not count', async () => {
    const charges = [
      { key: `${PREFIX}today`, atMs: CASE_NOW_MS, deleted: true },
    ];
    expect((await verdict('guest', charges)).code).toBe(QUOTA_NOT_CHARGED);
  });

  test('someone with no limit needs no charge', async () => {
    expect((await verdict('free account', [])).code).toBeNull();
    expect((await verdict('Plus member', [])).code).toBeNull();
  });
});
