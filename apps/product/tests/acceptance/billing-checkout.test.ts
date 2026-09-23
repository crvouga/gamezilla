import { describe, expect, test } from 'bun:test';
import {
  acceptanceApi,
  billingFault,
} from '@apps/product/sim/acceptance/system';

import {
  activate,
  checkout,
  nowSec,
  portal,
  postWebhook,
  stripeSignature,
  subscription,
} from './billing-support';
import { aliceIdentity, bobIdentity, call, login } from './support';

describe('Billing / checkout and provider failures', () => {
  for (const priceKey of ['subscription_monthly', 'subscription_yearly']) {
    test(`BILLING-001 ${priceKey} checkout grants access only after a verified event`, async () => {
      await using s = await acceptanceApi.run({ seed: 501 });
      const actor = await login(s, 1, aliceIdentity);
      await activate(s, actor, priceKey);
    });
  }

  test('BILLING-002 unsigned and tampered webhooks change nothing', async () => {
    await using s = await acceptanceApi.run({ seed: 502 });
    const actor = await login(s, 1, aliceIdentity);
    const { customerId } = await activate(s, actor);
    const before = await subscription(s, actor);
    const raw = JSON.stringify({
      id: 'evt_forged',
      type: 'customer.subscription.deleted',
      created: 1,
      data: { object: { customer: customerId, status: 'canceled' } },
    });
    const missing = await call(s, { path: '/billing/webhook', rawBody: raw });
    expect(missing.status).toBe(400);
    const forged = await call(s, {
      path: '/billing/webhook',
      headers: { 'stripe-signature': 't=1,v1=00' },
      rawBody: raw,
    });
    expect(forged.status).toBe(400);
    const signature = stripeSignature(raw, await nowSec(s));
    const tampered = await call(s, {
      path: '/billing/webhook',
      headers: { 'stripe-signature': signature },
      rawBody: raw.replace('canceled', 'unpaid'),
    });
    expect(tampered.status).toBe(400);
    expect(await subscription(s, actor)).toEqual(before);
  });

  test('BILLING-003 replaying an event id is idempotent', async () => {
    await using s = await acceptanceApi.run({ seed: 503 });
    const actor = await login(s, 1, aliceIdentity);
    await activate(s, actor);
    const event = {
      id: 'evt_replay',
      type: 'invoice.payment_succeeded',
      created: 1_800_000_000,
      data: {
        object: {
          customer: (await subscription(s, actor))!['customer_id'],
          subscription: `sub_${actor.accountId}`,
          period_end: 1_900_000_000,
        },
      },
    };
    expect((await postWebhook(s, event)).status).toBe(200);
    const before = await subscription(s, actor);
    expect((await postWebhook(s, event)).status).toBe(200);
    expect(await subscription(s, actor)).toEqual(before);
  });

  for (const fault of ['offline', 'http-503'] as const) {
    test(`BILLING-004 ${fault}: checkout fails closed and succeeds after recovery`, async () => {
      await using s = await acceptanceApi.run({ seed: 504 });
      const actor = await login(s, 1, aliceIdentity);
      await s.apply(billingFault, fault);
      expect((await checkout(s, actor)).status).toBe(503);
      expect(await subscription(s, actor)).toBeUndefined();
      await s.apply(billingFault, 'none');
      expect((await checkout(s, actor)).status).toBe(200);
    });
  }

  test('BILLING-005 portal requires a customer and fails closed during an outage', async () => {
    await using s = await acceptanceApi.run({ seed: 505 });
    const actor = await login(s, 1, aliceIdentity);
    const stranger = await login(s, 2, bobIdentity);
    expect((await portal(s, stranger)).status).toBe(404);
    await activate(s, actor);
    const open = await portal(s, actor);
    expect(open.status).toBe(200);
    expect(
      String((open.body as { url: string }).url).startsWith('https://')
    ).toBe(true);
    await s.apply(billingFault, 'offline');
    expect((await portal(s, actor)).status).toBe(503);
    await s.apply(billingFault, 'none');
    expect((await portal(s, actor)).status).toBe(200);
  });

  test('BILLING-006 checkout and portal reject anonymous callers and foreign return URLs', async () => {
    await using s = await acceptanceApi.run({ seed: 506 });
    const actor = await login(s, 1, aliceIdentity);
    expect(
      (
        await call(s, {
          path: '/billing/checkout',
          body: {
            priceKey: 'subscription_monthly',
            successUrl: 'http://localhost:5173/billing/success',
            cancelUrl: 'http://localhost:5173/billing/cancel',
          },
        })
      ).status
    ).toBe(401);
    expect((await checkout(s, actor, 'not-a-price')).status).toBe(400);
    for (const successUrl of [
      'https://evil.test/ok',
      'http://localhost:5173.evil.test/x',
      'javascript:alert(1)',
    ]) {
      const rejected = await checkout(s, actor, 'subscription_monthly', {
        successUrl,
      });
      expect(rejected.status).toBe(400);
      expect((rejected.body as { url?: string }).url).toBeUndefined();
    }
    expect((await portal(s, actor, 'https://evil.test/return')).status).toBe(
      400
    );
  });

  test('BILLING-007 a second checkout while entitled is refused', async () => {
    await using s = await acceptanceApi.run({ seed: 507 });
    const actor = await login(s, 1, aliceIdentity);
    await activate(s, actor, 'subscription_monthly');
    expect((await checkout(s, actor, 'subscription_yearly')).status).toBe(409);
    expect((await subscription(s, actor))?.['price_key']).toBe(
      'subscription_monthly'
    );
  });
});
