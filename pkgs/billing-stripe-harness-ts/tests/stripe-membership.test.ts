import { describe, expect, test } from 'bun:test';
import type { MembershipStatus } from '@pkgs/billing-root-shared-ts/membership';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared-ts/offer';
import { StripeTestMode } from '@pkgs/billing-stripe-harness-ts/stripe-test-mode';
import { createStripeMembershipBilling } from '@pkgs/billing-stripe-server-ts/stripe-membership';
import { membershipStatusOf } from '@pkgs/billing-stripe-shared-ts/membership-status';

const offer: PlusMembershipOffer = {
  product: {
    catalogProductId: 'subscription',
    name: 'Unlimited',
    description: 'Test product',
  },
  prices: {
    subscription_monthly: {
      key: 'subscription_monthly',
      catalogPriceId: 'subscription_monthly',
      unitAmount: 700,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 7,
      currencyOptions: { inr: { unitAmount: 29_900 } },
    },
    subscription_yearly: {
      key: 'subscription_yearly',
      catalogPriceId: 'subscription_yearly',
      unitAmount: 6000,
      currency: 'usd',
      interval: 'year',
      trialPeriodDays: 7,
      currencyOptions: { inr: { unitAmount: 499_00 } },
    },
  },
  defaultPriceKey: 'subscription_monthly',
  switchablePriceKeys: ['subscription_monthly', 'subscription_yearly'],
  portal: {
    defaultReturnUrlPath: '/more/billing',
    businessProfileHeadline: 'Acme Unlimited',
    cancellationReasons: ['too_expensive', 'other'],
  },
  callbackPath: '/api/billing/callback',
  callbackDescription: 'Acme membership callbacks',
};

describe('membershipStatusOf', () => {
  test('maps every Stripe subscription status onto ours', () => {
    const cases: ReadonlyArray<readonly [string, MembershipStatus]> = [
      ['incomplete', 'incomplete'],
      ['trialing', 'trialing'],
      ['active', 'active'],
      ['past_due', 'delinquent'],
      ['canceled', 'ended'],
      ['unpaid', 'ended'],
      ['incomplete_expired', 'ended'],
      ['paused', 'ended'],
    ];
    for (const [stripeStatus, expected] of cases) {
      expect(membershipStatusOf(stripeStatus)).toBe(expected);
    }
  });

  test('an unknown status fails closed to ended', () => {
    expect(membershipStatusOf('mystery_status')).toBe('ended');
  });
});

const RETURN_URL = 'https://app.test/return';

/** Stripe in test mode, the offer's prices seeded, and the adapter over it. */
async function openAdapter(
  options: { readonly seeded?: boolean; readonly webhookSecret?: null } = {}
) {
  const stripe = new StripeTestMode({ nowMs: 1_800_000_000_000 });
  if (options.seeded !== false) {
    await stripe.seedPrices(
      Object.values(offer.prices).map((spec) => spec.catalogPriceId)
    );
  }
  const billing = createStripeMembershipBilling({
    secretKey: stripe.secretKey,
    webhookSecret: options.webhookSecret === null ? null : stripe.webhookSecret,
    offer,
    now: () => stripe.now(),
    transport: { origin: stripe.origin, fetch: stripe.fetch },
  });
  return { stripe, billing };
}

describe('StripeMembershipBilling', () => {
  test('a paid checkout is a trialing subscription on the offer price, carrying the account', async () => {
    const { stripe, billing } = await openAdapter();
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: 'person@people.test',
      returnUrl: RETURN_URL,
    });
    if (result.kind !== 'checkout') throw new Error(result.kind);
    const customer = await stripe.stripe.customers.retrieve(result.customerId);
    expect(customer.deleted).toBeUndefined();
    if (customer.deleted === true) throw new Error('unreachable');
    expect(customer.email).toBe('person@people.test');
    expect(customer.metadata).toEqual({ accountId: 'acct-1' });

    const [session] = (await stripe.stripe.checkout.sessions.list()).data;
    expect(session?.url).toBe(result.url);
    expect(session?.client_reference_id).toBe('acct-1');
    await stripe.completeCheckout(session?.id ?? '');

    const [subscription] = (
      await stripe.stripe.subscriptions.list({ customer: result.customerId })
    ).data;
    expect(subscription?.status).toBe('trialing');
    expect(subscription?.metadata).toEqual({ accountId: 'acct-1' });
    expect(subscription?.items.data[0]?.price.lookup_key).toBe(
      'subscription_monthly'
    );
    expect(
      ((subscription?.trial_end ?? 0) - (subscription?.trial_start ?? 0)) /
        86_400
    ).toBe(7);
  });

  test('startCheckout reuses a supplied customer', async () => {
    const { stripe, billing } = await openAdapter();
    const existing = await stripe.stripe.customers.create({
      email: 'person@people.test',
    });
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: existing.id,
      email: null,
      returnUrl: RETURN_URL,
    });
    if (result.kind !== 'checkout') throw new Error(result.kind);
    expect(result.customerId).toBe(existing.id);
    const customers = await stripe.stripe.customers.list();
    expect(customers.data.map((c) => c.id)).toEqual([existing.id]);
  });

  test('startCheckout throws when the offer price is missing upstream', async () => {
    const { stripe, billing } = await openAdapter({ seeded: false });
    const customer = await stripe.stripe.customers.create({});
    await expect(
      billing.startCheckout({
        accountId: 'acct-1',
        customerId: customer.id,
        email: null,
        returnUrl: RETURN_URL,
      })
    ).rejects.toThrow(
      'stripe: no active price for lookup key subscription_monthly'
    );
  });

  test('openPortal opens the hosted billing portal for the customer', async () => {
    const { stripe, billing } = await openAdapter();
    const customer = await stripe.stripe.customers.create({});
    const result = await billing.openPortal({
      accountId: 'acct-1',
      customerId: customer.id,
      returnUrl: RETURN_URL,
    });
    expect(result.url.startsWith(`${stripe.origin}/p/session/`)).toBe(true);
  });

  test('readCallback is unverified without a signing secret', async () => {
    const { stripe, billing } = await openAdapter({ webhookSecret: null });
    const result = await billing.readCallback(
      await stripe.signed({
        rawBody: '{}',
        timestampS: Math.floor(stripe.now() / 1000),
      })
    );
    expect(result.kind).toBe('unverified');
  });

  test('readCallback reports customer credit in cents, never a debt', async () => {
    const { stripe, billing } = await openAdapter();
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      email: 'person@people.test',
      returnUrl: RETURN_URL,
    });
    if (result.kind !== 'checkout') throw new Error(result.kind);
    const [session] = (await stripe.stripe.checkout.sessions.list()).data;
    await stripe.completeCheckout(session?.id ?? '');
    const [subscription] = (
      await stripe.stripe.subscriptions.list({ customer: result.customerId })
    ).data;
    const event = stripe.lastSent(
      'customer.subscription.created',
      subscription?.id ?? ''
    );
    const read = async (): Promise<
      Awaited<ReturnType<typeof billing.readCallback>>
    > =>
      await billing.readCallback(
        await stripe.signed({
          rawBody: event.body,
          timestampS: Math.floor(stripe.now() / 1000),
        })
      );
    await stripe.stripe.customers.createBalanceTransaction(result.customerId, {
      amount: -5300,
      currency: 'usd',
    });
    expect(await read()).toMatchObject({
      kind: 'membership',
      creditCents: 5300,
    });
    await stripe.stripe.customers.createBalanceTransaction(result.customerId, {
      amount: 5700,
      currency: 'usd',
    });
    expect(await read()).toMatchObject({ kind: 'membership', creditCents: 0 });
  });

  test('readCallback ignores an unrelated event type', async () => {
    const { stripe, billing } = await openAdapter();
    const customer = await stripe.stripe.customers.create({});
    const result = await billing.readCallback(
      await stripe.signed({
        rawBody: stripe.lastSent('customer.created', customer.id).body,
        timestampS: Math.floor(stripe.now() / 1000),
      })
    );
    expect(result.kind).toBe('ignored');
  });
});
