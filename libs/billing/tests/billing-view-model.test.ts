/**
 * The billing screen's view model over its whole input space: every plan tier
 * × membership row × billing switch × customer link, against a table written
 * out by hand, plus properties over arbitrary (including unreadable) rows.
 */
import { describe, expect, test } from 'bun:test';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import {
  type BillingNotice,
  type BillingPrimaryAction,
  type BillingTier,
  type BillingViewInput,
  buildBillingView,
  formatMinorUnits,
  type MembershipRow,
  type MembershipState,
  membershipMenuEntry,
  summarizeOffer,
} from '@libs/billing/root/client/billing-view-model';
import fc from 'fast-check';

import {
  DAY,
  inputFor,
  NOW,
  PAST_END,
  PERIOD_END,
  ROW_KINDS,
  type RowKind,
  row,
  TIERS,
} from './support/billing-matrix';

const KINDS = Object.keys(ROW_KINDS) as RowKind[];

const FC = { numRuns: 300, seed: 424_242 } as const;

type Expected = {
  readonly state: MembershipState;
  readonly primary: BillingPrimaryAction;
  readonly notice: BillingNotice | null;
};

/** Billing on: what a free and a paid account see, per row. */
const SIGNED_IN: Record<RowKind, { free: Expected; paid: Expected }> = {
  none: {
    free: { state: 'none', primary: 'subscribe', notice: null },
    paid: { state: 'none', primary: 'none', notice: null },
  },
  incomplete: {
    free: { state: 'incomplete', primary: 'subscribe', notice: 'incomplete' },
    paid: { state: 'incomplete', primary: 'none', notice: 'incomplete' },
  },
  trialing: {
    free: { state: 'trialing', primary: 'none', notice: null },
    paid: { state: 'trialing', primary: 'none', notice: null },
  },
  active: {
    free: { state: 'active', primary: 'none', notice: null },
    paid: { state: 'active', primary: 'none', notice: null },
  },
  canceling: {
    free: { state: 'canceling', primary: 'none', notice: null },
    paid: { state: 'canceling', primary: 'none', notice: null },
  },
  delinquent: {
    free: { state: 'delinquent', primary: 'none', notice: 'delinquent' },
    paid: { state: 'delinquent', primary: 'none', notice: 'delinquent' },
  },
  ended: {
    free: { state: 'ended', primary: 'subscribe', notice: null },
    paid: { state: 'ended', primary: 'none', notice: null },
  },
};

function expected(
  tier: BillingTier,
  kind: RowKind,
  billingEnabled: boolean
): Expected {
  if (tier === 'guest') {
    return billingEnabled
      ? { state: 'none', primary: 'sign_in', notice: null }
      : { state: 'none', primary: 'none', notice: 'unavailable' };
  }
  const signedIn = SIGNED_IN[kind][tier];
  return billingEnabled
    ? signedIn
    : { state: signedIn.state, primary: 'none', notice: 'unavailable' };
}

describe('billing view: every tier × row × switch × customer', () => {
  for (const tier of TIERS) {
    for (const kind of KINDS) {
      for (const enabled of [true, false]) {
        for (const hasCustomer of [true, false]) {
          const name = `${tier} · ${kind} · billing ${enabled ? 'on' : 'off'} · ${hasCustomer ? 'customer' : 'no customer'}`;
          test(name, () => {
            const view = buildBillingView(
              inputFor(tier, kind, enabled, hasCustomer)
            );
            expect({
              state: view.state,
              primary: view.primary,
              notice: view.notice,
            }).toEqual(expected(tier, kind, enabled));
            expect(view.manage).toBe(
              enabled && tier !== 'guest' && hasCustomer
            );
            expect(view.showPricing).toBe(enabled);
          });
        }
      }
    }
  }
});

describe('billing view: dates', () => {
  test('a trial counts whole days down to its end', () => {
    const view = buildBillingView(inputFor('paid', 'trialing', true, true));
    expect(view.periodEndMs).toBe(Date.parse(PERIOD_END));
    expect(view.daysLeft).toBe(10);
  });

  test('an end in the past has no days left', () => {
    const view = buildBillingView(inputFor('free', 'ended', true, true));
    expect(view.periodEndMs).toBe(Date.parse(PAST_END));
    expect(view.daysLeft).toBeNull();
  });

  test('an incomplete checkout has no date', () => {
    const view = buildBillingView(inputFor('free', 'incomplete', true, true));
    expect(view.periodEndMs).toBeNull();
    expect(view.priceKey).toBe('subscription_monthly');
  });

  test('a trialing row set to cancel reads as canceling', () => {
    const view = buildBillingView({
      ...inputFor('paid', 'trialing', true, true),
      row: row('trialing', true),
    });
    expect(view.state).toBe('canceling');
  });
});

const arbRow: fc.Arbitrary<MembershipRow | null> = fc.option(
  fc.record({
    status: fc.option(
      fc.oneof(
        fc.constantFrom(
          'incomplete',
          'trialing',
          'active',
          'delinquent',
          'ended',
          'past_due',
          ''
        ),
        fc.string()
      ),
      { nil: null }
    ),
    price_key: fc.option(
      fc.constantFrom('subscription_monthly', 'subscription_yearly', 'legacy'),
      { nil: null }
    ),
    current_period_end: fc.option(
      fc.oneof(
        fc
          .integer({ min: NOW - 400 * DAY, max: NOW + 400 * DAY })
          .map((ms) => new Date(ms).toISOString()),
        fc.string()
      ),
      { nil: null }
    ),
    cancel_at_period_end: fc.option(fc.constantFrom(0, 1, true, false), {
      nil: null,
    }),
  }),
  { nil: null }
);

const arbInput: fc.Arbitrary<BillingViewInput> = fc.record({
  tier: fc.constantFrom<BillingTier>('guest', 'free', 'paid'),
  billingEnabled: fc.boolean(),
  canSubscribe: fc.boolean(),
  canManage: fc.boolean(),
  hasCustomer: fc.boolean(),
  row: arbRow,
  nowMs: fc.constant(NOW),
});

describe('billing view: properties over arbitrary rows', () => {
  test('a guest is only ever offered sign-in', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView({ ...input, tier: 'guest' });
        expect(view.state).toBe('none');
        expect(view.manage).toBe(false);
        expect(view.primary).toBe(input.billingEnabled ? 'sign_in' : 'none');
      }),
      FC
    );
  });

  test('a paying member is never offered a second checkout', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        expect(buildBillingView({ ...input, tier: 'paid' }).primary).not.toBe(
          'subscribe'
        );
      }),
      FC
    );
  });

  test('a failed payment always shows the notice and never a checkout', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView(input);
        if (view.state !== 'delinquent') return;
        expect(view.primary).toBe('none');
        expect(view.notice).toBe(
          input.billingEnabled ? 'delinquent' : 'unavailable'
        );
      }),
      FC
    );
  });

  test('billing off offers nothing', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView({ ...input, billingEnabled: false });
        expect(view.primary).toBe('none');
        expect(view.manage).toBe(false);
        expect(view.showPricing).toBe(false);
        expect(view.notice).toBe('unavailable');
      }),
      FC
    );
  });

  test('checkout needs the subscribe grant, the portal the manage grant', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView(input);
        if (view.primary === 'subscribe') expect(input.canSubscribe).toBe(true);
        if (view.manage) {
          expect(input.canManage && input.hasCustomer).toBe(true);
        }
      }),
      FC
    );
  });

  test('an unreadable status reads as no membership', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView(input);
        const known = [
          'incomplete',
          'trialing',
          'active',
          'delinquent',
          'ended',
        ];
        if (!known.includes(input.row?.status ?? '')) {
          expect(view.state).toBe('none');
          expect(view.periodEndMs).toBeNull();
          expect(view.priceKey).toBeNull();
        }
      }),
      FC
    );
  });

  test('days left is never negative and only with a future end', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView(input);
        if (view.daysLeft === null) return;
        expect(view.daysLeft).toBeGreaterThanOrEqual(0);
        expect(view.periodEndMs).not.toBeNull();
        expect(view.periodEndMs ?? 0).toBeGreaterThanOrEqual(input.nowMs);
      }),
      FC
    );
  });
});

describe('offer summary', () => {
  test('prices come from the offer, with the yearly saving', () => {
    const [monthly, yearly] = summarizeOffer(PLUS_MEMBERSHIP_OFFER);
    expect(monthly).toMatchObject({
      key: 'subscription_monthly',
      unitAmount: 700,
      savingsPercent: null,
      trialDays: 7,
    });
    expect(yearly).toMatchObject({
      key: 'subscription_yearly',
      unitAmount: 6000,
      perMonthAmount: 500,
      savingsPercent: 29,
    });
  });

  test('minor units format per currency', () => {
    expect(formatMinorUnits(700, 'usd', 'en-US')).toBe('$7.00');
    expect(formatMinorUnits(1050, 'jpy', 'en-US')).toBe('¥1,050');
  });
});

describe('global menu chip', () => {
  test('one chip per tier while billing is on, none while off', () => {
    for (const tier of TIERS) {
      expect(membershipMenuEntry(tier, true)).toEqual({
        tier,
        highlighted: tier === 'paid',
      });
      expect(membershipMenuEntry(tier, false)).toBeNull();
    }
  });
});
