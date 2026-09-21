// goal:guest-free-and-paid:9
import { describe, expect, test } from 'bun:test';
import type { MembershipStatus, PlusMembershipOffer } from '@pkgs/billing';
import { membershipStatusOf } from './membership-status';
import { StripeMembershipBilling } from './stripe-membership';

const offer: PlusMembershipOffer = {
  product: {
    catalogProductId: 'subscription',
    name: 'Unlimited',
    description: 'Test product',
  },
  prices: {
    subscription_monthly: {
      key: 'subscription_monthly',
      lookupKey: 'subscription_monthly',
      unitAmount: 700,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 7,
      currencyOptions: { inr: { unitAmount: 29_900 } },
    },
    subscription_yearly: {
      key: 'subscription_yearly',
      lookupKey: 'subscription_yearly',
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
    businessProfileHeadline: 'Gamezilla Unlimited',
    cancellationReasons: ['too_expensive', 'other'],
  },
  callbackPath: '/api/billing/callback',
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

describe('StripeMembershipBilling', () => {
  test('startCheckout resolves the offer price and carries the account id', async () => {
    const sessionInputs: Array<Record<string, unknown>> = [];
    const listInputs: Array<Record<string, unknown>> = [];
    const stripe = {
      customers: {
        create: () => Promise.resolve({ id: 'cus_new' }),
      },
      prices: {
        list: (input: Record<string, unknown>) => {
          listInputs.push(input);
          return Promise.resolve({ data: [{ id: 'price_1' }] });
        },
      },
      checkout: {
        sessions: {
          create: (input: Record<string, unknown>) => {
            sessionInputs.push(input);
            return Promise.resolve({
              id: 'cs_1',
              url: 'https://pay.test/cs_1',
            });
          },
        },
      },
    };
    const billing = new StripeMembershipBilling(
      stripe as never,
      offer,
      null,
      () => 0
    );
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      returnUrl: 'https://app.test/return',
    });
    expect(result.customerId).toBe('cus_new');
    expect(result.url).toBe('https://pay.test/cs_1');
    expect(listInputs[0]?.['lookup_keys']).toEqual(['subscription_monthly']);
    expect(listInputs[0]?.['active']).toBe(true);
    expect(sessionInputs[0]?.['mode']).toBe('subscription');
    expect(sessionInputs[0]?.['customer']).toBe('cus_new');
    expect(sessionInputs[0]?.['client_reference_id']).toBe('acct-1');
    expect(sessionInputs[0]?.['subscription_data']).toEqual({
      metadata: { accountId: 'acct-1' },
      trial_period_days: 7,
    });
    expect(sessionInputs[0]?.['line_items']).toEqual([
      { price: 'price_1', quantity: 1 },
    ]);
  });

  test('startCheckout reuses a supplied customer', async () => {
    let customersCreated = 0;
    const stripe = {
      customers: {
        create: () => {
          customersCreated += 1;
          return Promise.resolve({ id: 'cus_new' });
        },
      },
      prices: {
        list: () => Promise.resolve({ data: [{ id: 'price_1' }] }),
      },
      checkout: {
        sessions: {
          create: () =>
            Promise.resolve({ id: 'cs_1', url: 'https://pay.test' }),
        },
      },
    };
    const billing = new StripeMembershipBilling(
      stripe as never,
      offer,
      null,
      () => 0
    );
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: 'cus_existing',
      returnUrl: 'https://app.test/return',
    });
    expect(result.customerId).toBe('cus_existing');
    expect(customersCreated).toBe(0);
  });

  test('startCheckout throws when the offer price is missing upstream', async () => {
    const stripe = {
      prices: { list: () => Promise.resolve({ data: [] }) },
    };
    const billing = new StripeMembershipBilling(
      stripe as never,
      offer,
      null,
      () => 0
    );
    await expect(
      billing.startCheckout({
        accountId: 'acct-1',
        customerId: 'cus_1',
        returnUrl: 'https://app.test/return',
      })
    ).rejects.toThrow(
      'stripe: no active price for lookup key subscription_monthly'
    );
  });

  test('openPortal maps the url', async () => {
    const stripe = {
      billingPortal: {
        sessions: {
          create: () =>
            Promise.resolve({ url: 'https://billing.test/portal/cus_1' }),
        },
      },
    };
    const billing = new StripeMembershipBilling(
      stripe as never,
      offer,
      null,
      () => 0
    );
    const result = await billing.openPortal({
      accountId: 'acct-1',
      customerId: 'cus_1',
      returnUrl: 'https://app.test/return',
    });
    expect(result.url).toBe('https://billing.test/portal/cus_1');
  });

  test('readCallback is unverified without a signing secret', async () => {
    const billing = new StripeMembershipBilling(
      {} as never,
      offer,
      null,
      () => 0
    );
    const result = await billing.readCallback({
      headers: new Headers({ 'stripe-signature': 'sig' }),
      rawBody: '{}',
    });
    expect(result.kind).toBe('unverified');
  });

  test('readCallback ignores an unrelated event type', async () => {
    const stripe = {
      webhooks: {
        constructEventAsync: () =>
          Promise.resolve({ type: 'invoice.paid', data: { object: {} } }),
      },
    };
    const billing = new StripeMembershipBilling(
      stripe as never,
      offer,
      'whsec_test',
      () => 0
    );
    const result = await billing.readCallback({
      headers: new Headers({ 'stripe-signature': 'sig' }),
      rawBody: '{}',
    });
    expect(result.kind).toBe('ignored');
  });

  test('readCallback projects the subscription as Stripe reports it now', async () => {
    const current = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_end: 1_700_000_000,
            price: { lookup_key: 'subscription_monthly' },
          },
        ],
      },
    };
    const retrieved: string[] = [];
    const stripe = {
      webhooks: {
        constructEventAsync: () =>
          Promise.resolve({
            type: 'customer.subscription.updated',
            // A stale snapshot: the adapter must not trust it.
            data: { object: { ...current, status: 'trialing' } },
          }),
      },
      subscriptions: {
        retrieve: (id: string) => {
          retrieved.push(id);
          return Promise.resolve(current);
        },
      },
    };
    const billing = new StripeMembershipBilling(
      stripe as never,
      offer,
      'whsec_test',
      () => 0
    );
    const result = await billing.readCallback({
      headers: new Headers({ 'stripe-signature': 'sig' }),
      rawBody: '{}',
    });
    expect(retrieved).toEqual(['sub_1']);
    expect(result.kind).toBe('membership');
    if (result.kind !== 'membership') throw new Error('unreachable');
    expect(result.provider).toBe('stripe');
    expect(result.customerId).toBe('cus_1');
    expect(result.subscriptionId).toBe('sub_1');
    expect(result.offerPriceKey).toBe('subscription_monthly');
    expect(result.membership).toEqual({
      status: 'active',
      periodEndMs: 1_700_000_000_000,
      endsAtPeriodEnd: false,
    });
  });
});
