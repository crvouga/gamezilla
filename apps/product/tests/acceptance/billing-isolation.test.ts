import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';

import { appleLogin } from './apple-support';
import {
  access,
  activate,
  paymentSucceeded,
  postWebhook,
  subscription,
  subscriptionUpdated,
} from './billing-support';
import {
  aliceIdentity,
  applied,
  bobIdentity,
  call,
  headers,
  login,
  query,
} from './support';

describe('Billing / account isolation', () => {
  test('BILLING-020 another account cannot adopt this customer', async () => {
    await using s = await acceptanceApi.run({ seed: 520 });
    const owner = await login(s, 1, aliceIdentity);
    const other = await login(s, 2, bobIdentity);
    const { customerId, periodEnd } = await activate(s, owner);
    const stolen = await postWebhook(
      s,
      subscriptionUpdated({
        id: 'evt_steal',
        accountId: other.accountId,
        customerId,
        status: 'active',
        created: periodEnd,
        trialEnd: null,
        periodEnd: periodEnd + 30 * 24 * 60 * 60,
        priceKey: 'subscription_yearly',
      })
    );
    expect(stolen.status).toBe(400);
    expect(await access(s, other)).toBe(false);
    expect((await subscription(s, owner))?.['price_key']).toBe(
      'subscription_monthly'
    );
    expect(await access(s, owner)).toBe(true);
  });

  test('BILLING-021 an unknown customer grants nobody access', async () => {
    await using s = await acceptanceApi.run({ seed: 521 });
    const owner = await login(s, 1, aliceIdentity);
    const result = await postWebhook(
      s,
      subscriptionUpdated({
        id: 'evt_unknown',
        accountId: owner.accountId,
        customerId: 'cus_unknown',
        status: 'active',
        created: 1_800_000_000,
        trialEnd: null,
        periodEnd: 1_900_000_000,
        priceKey: 'subscription_monthly',
      })
    );
    expect(result.status).toBe(400);
    expect(await subscription(s, owner)).toBeUndefined();
  });

  test('BILLING-022 entitlement follows the account across link, switch, and unlink', async () => {
    await using s = await acceptanceApi.run({ seed: 522 });
    const owner = await login(s, 1, aliceIdentity);
    const { customerId, created } = await activate(s, owner);
    await applied(s, owner, 'claimUsername', { username: 'paying_owner' });
    const before = await query(s, owner, 'ownProfile');
    const second = { sub: 'second-google', email: null };
    const linked = await login(s, 1, second, owner);
    expect(linked.accountId).toBe(owner.accountId);
    expect(await access(s, linked)).toBe(true);
    const apple = await appleLogin(
      s,
      1,
      {
        sub: 'apple-payer',
        email: 'relay@privaterelay.appleid.com',
        privateEmail: true,
      },
      owner
    );
    expect(apple.accountId).toBe(owner.accountId);
    expect(await access(s, apple)).toBe(true);
    const other = await login(s, 1, bobIdentity);
    expect(await access(s, other)).toBe(false);
    const again = await login(s, 2, second);
    expect(again.accountId).toBe(owner.accountId);
    expect(await query(s, again, 'ownProfile')).toEqual(before);
    expect(
      (
        await postWebhook(
          s,
          paymentSucceeded({
            id: 'evt_keep',
            accountId: owner.accountId,
            customerId,
            created,
            periodEnd: created + 60 * 24 * 60 * 60,
          })
        )
      ).status
    ).toBe(200);
    const unlinked = await call(s, {
      path: '/auth/accounts/unlink',
      headers: headers(owner),
      body: { provider: 'google', subject: second.sub },
    });
    expect(unlinked.status).toBe(200);
    const detached = await login(s, 3, second);
    expect(detached.accountId).not.toBe(owner.accountId);
    expect(await access(s, detached)).toBe(false);
    expect(await access(s, await login(s, 4, aliceIdentity))).toBe(true);
  });
});
