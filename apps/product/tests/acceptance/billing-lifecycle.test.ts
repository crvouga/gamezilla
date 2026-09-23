import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';

import {
  access,
  activate,
  checkout,
  GRACE_MS,
  paymentFailed,
  paymentSucceeded,
  postWebhook,
  subscription,
  subscriptionUpdated,
} from './billing-support';
import { type ApiRun, aliceIdentity, login } from './support';

async function failPayment(args: {
  s: ApiRun;
  accountId: string;
  customerId: string;
  id: string;
  created: number;
}) {
  const result = await postWebhook(
    args.s,
    paymentFailed({
      id: args.id,
      accountId: args.accountId,
      customerId: args.customerId,
      created: args.created,
    })
  );
  expect(result.status).toBe(200);
}

describe('Billing / grace, lapse, and recovery', () => {
  test('BILLING-010 the first failure opens a 7-day grace and a repeat does not extend it', async () => {
    await using s = await acceptanceApi.run({ seed: 510 });
    const actor = await login(s, 1, aliceIdentity);
    const { customerId, created } = await activate(s, actor);
    const failedAt = created;
    await failPayment({
      s,
      accountId: actor.accountId,
      customerId,
      id: 'evt_fail_1',
      created: failedAt,
    });
    const graceMs = failedAt * 1000 + GRACE_MS;
    const row = await subscription(s, actor);
    expect(row?.['status']).toBe('past_due');
    expect(Date.parse(String(row?.['grace_until']))).toBe(graceMs);
    expect(await access(s, actor)).toBe(true);
    await s.advanceTime(3 * 24 * 60 * 60 * 1000);
    await failPayment({
      s,
      accountId: actor.accountId,
      customerId,
      id: 'evt_fail_2',
      created: failedAt + 3 * 24 * 60 * 60,
    });
    expect(
      Date.parse(String((await subscription(s, actor))?.['grace_until']))
    ).toBe(graceMs);
    const beforeBoundary = await s.read(async (api) =>
      api.session.ports.clock.now()
    );
    await s.advanceTime(graceMs - 1 - beforeBoundary);
    expect(await access(s, actor)).toBe(true);
    await s.advanceTime(1);
    expect(await access(s, actor)).toBe(false);
  });

  test('BILLING-011 a delayed failure event still anchors grace to the event time', async () => {
    await using s = await acceptanceApi.run({ seed: 511 });
    const actor = await login(s, 1, aliceIdentity);
    const { customerId, created } = await activate(s, actor);
    await s.advanceTime(3 * 24 * 60 * 60 * 1000);
    await failPayment({
      s,
      accountId: actor.accountId,
      customerId,
      id: 'evt_late',
      created,
    });
    const graceMs = created * 1000 + GRACE_MS;
    expect(
      Date.parse(String((await subscription(s, actor))?.['grace_until']))
    ).toBe(graceMs);
  });

  test('BILLING-012 payment during grace restores access and a later failure starts a new grace', async () => {
    await using s = await acceptanceApi.run({ seed: 512 });
    const actor = await login(s, 1, aliceIdentity);
    const first = await activate(s, actor);
    await failPayment({
      s,
      accountId: actor.accountId,
      customerId: first.customerId,
      id: 'evt_fail',
      created: first.created,
    });
    await s.advanceTime(24 * 60 * 60 * 1000);
    const paidAt = Math.floor(
      (await s.read(async (api) => api.session.ports.clock.now())) / 1000
    );
    const periodEnd = paidAt + 30 * 24 * 60 * 60;
    expect(
      (
        await postWebhook(
          s,
          paymentSucceeded({
            id: 'evt_paid',
            accountId: actor.accountId,
            customerId: first.customerId,
            created: paidAt,
            periodEnd,
          })
        )
      ).status
    ).toBe(200);
    expect((await subscription(s, actor))?.['status']).toBe('active');
    expect((await subscription(s, actor))?.['grace_until']).toBeNull();
    expect(await access(s, actor)).toBe(true);
    await failPayment({
      s,
      accountId: actor.accountId,
      customerId: first.customerId,
      id: 'evt_fail_again',
      created: paidAt,
    });
    expect(
      Date.parse(String((await subscription(s, actor))?.['grace_until']))
    ).toBe(paidAt * 1000 + GRACE_MS);
  });

  test('BILLING-013 unpaid and incomplete states never grant access', async () => {
    await using s = await acceptanceApi.run({ seed: 513 });
    const actor = await login(s, 1, aliceIdentity);
    const { customerId, created, periodEnd } = await activate(s, actor);
    for (const status of ['incomplete', 'incomplete_expired', 'unpaid']) {
      expect(
        (
          await postWebhook(
            s,
            subscriptionUpdated({
              id: `evt_${status}`,
              accountId: actor.accountId,
              customerId,
              status,
              created,
              trialEnd: null,
              periodEnd,
              priceKey: 'subscription_monthly',
            })
          )
        ).status
      ).toBe(200);
      expect((await subscription(s, actor))?.['status']).toBe(status);
      expect(await access(s, actor)).toBe(false);
    }
  });

  test('BILLING-014 cancel keeps access until period end, then checkout is allowed again', async () => {
    await using s = await acceptanceApi.run({ seed: 514 });
    const actor = await login(s, 1, aliceIdentity);
    const { customerId, created, periodEnd } = await activate(s, actor);
    expect(
      (
        await postWebhook(
          s,
          subscriptionUpdated({
            id: 'evt_cancel',
            accountId: actor.accountId,
            customerId,
            status: 'canceled',
            created,
            trialEnd: null,
            periodEnd,
            cancelAtPeriodEnd: true,
            priceKey: 'subscription_monthly',
          })
        )
      ).status
    ).toBe(200);
    expect(await access(s, actor)).toBe(true);
    expect((await checkout(s, actor)).status).toBe(409);
    const now = await s.read(async (api) => api.session.ports.clock.now());
    await s.advanceTime(periodEnd * 1000 - now);
    expect(await access(s, actor)).toBe(false);
    expect((await checkout(s, actor)).status).toBe(200);
  });

  test('BILLING-015 a trial grants access until trial_end and a failure then opens grace', async () => {
    await using s = await acceptanceApi.run({ seed: 515 });
    const actor = await login(s, 1, aliceIdentity);
    const started = await checkout(s, actor);
    expect(started.status).toBe(200);
    const customerId = (started.body as { customerId: string }).customerId;
    const created = Math.floor(
      (await s.read(async (api) => api.session.ports.clock.now())) / 1000
    );
    const trialEnd = created + 7 * 24 * 60 * 60;
    expect(
      (
        await postWebhook(
          s,
          subscriptionUpdated({
            id: 'evt_trial',
            accountId: actor.accountId,
            customerId,
            status: 'trialing',
            created,
            trialEnd,
            periodEnd: trialEnd,
            priceKey: 'subscription_monthly',
          })
        )
      ).status
    ).toBe(200);
    expect(await access(s, actor)).toBe(true);
    const now = await s.read(async (api) => api.session.ports.clock.now());
    await s.advanceTime(trialEnd * 1000 - now);
    expect(await access(s, actor)).toBe(false);
    await failPayment({
      s,
      accountId: actor.accountId,
      customerId,
      id: 'evt_trial_fail',
      created: trialEnd,
    });
    expect(await access(s, actor)).toBe(true);
    expect(
      Date.parse(String((await subscription(s, actor))?.['grace_until']))
    ).toBe(trialEnd * 1000 + GRACE_MS);
  });
});
