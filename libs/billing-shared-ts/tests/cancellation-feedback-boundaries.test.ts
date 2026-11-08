import { expect, test } from 'bun:test';
import { BILLING_PRIVACY } from '@libs/billing-shared-ts/account-privacy';
import { myCancellationFeedback } from '@libs/billing-shared-ts/my-cancellation-feedback-query';
import {
  cancellationFeedbackArgsSchema,
  shareCancellationFeedbackMutation,
} from '@libs/billing-shared-ts/share-cancellation-feedback-mutation';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { CASE_NOW_MS, DMN_INPUT } from '@libs/permissions-shared-ts/people';
import {
  mutationEnvFor,
  openConformanceDb,
  seedAccess,
} from '@libs/permissions-shared-ts/world';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { QueryCtx } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';

async function fixture() {
  const db = await openConformanceDb(BILLING_TABLES);
  const env = mutationEnvFor('free account', CASE_NOW_MS);
  await seedAccess(db, {
    input: { [DMN_INPUT.who]: 'free account', [DMN_INPUT.payments]: 'yes' },
    nowMs: CASE_NOW_MS,
  });
  for (const [id, owner] of [
    ['mine', env.actorId],
    ['theirs', 'bob'],
  ]) {
    await db.run(sql`INSERT INTO billing_subscriptions
      (id, account_id, provider, provider_subscription_id, status, cancel_at_period_end, created_at, updated_at)
      VALUES (${id}, ${owner}, ${'provider'}, ${id}, ${'active'}, ${true}, ${env.now().toISOString()}, ${env.now().toISOString()})`);
  }
  const ctx = { tx: wrapMutationDb(db, env).tx, env };
  return { db, env, ctx };
}

const rooms = new Proxy({} as Parameters<typeof BILLING_PRIVACY.snapshot>[1], {
  get() {
    throw new Error('Billing privacy must not call the rooms service');
  },
});

test('feedback ownership is enforced on writes and raw query scope', async () => {
  const { db, env, ctx } = await fixture();
  try {
    const answer = {
      subscriptionId: 'mine',
      reason: 'price' as const,
      comment: '',
    };
    await shareCancellationFeedbackMutation.run(ctx, answer);
    await shareCancellationFeedbackMutation.run(ctx, {
      ...answer,
      comment: 'Replacement',
    });
    await expect(
      shareCancellationFeedbackMutation.run(ctx, {
        ...answer,
        subscriptionId: 'theirs',
      })
    ).rejects.toMatchObject({ code: 'CANCELLATION_REQUIRED' });
    const queryDb: QueryCtx['db'] = {
      query: (query) => db.query(sql<QueryRow>`${query}`),
    };
    const own = await myCancellationFeedback.run({ db: queryDb, env }, {});
    expect(own['billing_cancellation_feedback']).toHaveLength(1);
    expect(own['billing_cancellation_feedback']?.[0]?.['comment']).toBe(
      'Replacement'
    );
    const other = await myCancellationFeedback.run(
      { db: queryDb, env: { ...env, actorId: 'bob', accountId: 'bob' } },
      {}
    );
    expect(other['billing_cancellation_feedback']).toEqual([]);
    await expect(
      shareCancellationFeedbackMutation.run(
        { ...ctx, env: mutationEnvFor('guest', CASE_NOW_MS) },
        answer
      )
    ).rejects.toMatchObject({ code: 'requires_account' });
  } finally {
    await db.disconnect();
  }
});

test('feedback export and erasure treat comments as personal data', async () => {
  const { db, env, ctx } = await fixture();
  try {
    await shareCancellationFeedbackMutation.run(ctx, {
      subscriptionId: 'mine',
      reason: '',
      comment: 'Personal explanation',
    });
    expect(await BILLING_PRIVACY.snapshot(ctx, rooms)).toMatchObject({
      cancellationFeedback: [{ reason: '', comment: 'Personal explanation' }],
    });
    await db.run(
      sql`UPDATE billing_cancellation_feedback SET deleted_at = ${env.now().toISOString()} WHERE account_id = ${env.actorId}`
    );
    await BILLING_PRIVACY.erase(ctx, rooms);
    const rows = await db.query(
      sql<
        Record<string, unknown>
      >`SELECT account_id, subscription_id, reason, comment FROM billing_cancellation_feedback`
    );
    expect(rows).toEqual([
      { account_id: null, subscription_id: null, reason: null, comment: null },
    ]);
    expect(await BILLING_PRIVACY.snapshot(ctx, rooms)).toMatchObject({
      cancellationFeedback: [],
    });
  } finally {
    await db.disconnect();
  }
});

test('feedback input accepts empty optional fields and bounds untrusted comments and reasons', () => {
  const empty = { subscriptionId: 'mine', reason: '', comment: '' };
  expect(cancellationFeedbackArgsSchema.safeParse(empty).success).toBe(true);
  expect(
    cancellationFeedbackArgsSchema.safeParse({
      ...empty,
      comment: 'x'.repeat(2000),
    }).success
  ).toBe(true);
  expect(
    cancellationFeedbackArgsSchema.safeParse({
      ...empty,
      comment: 'x'.repeat(2001),
    }).success
  ).toBe(false);
  expect(
    cancellationFeedbackArgsSchema.safeParse({
      ...empty,
      reason: 'unrecognized',
    }).success
  ).toBe(false);
});
