/**
 * The billing screen's view model over its whole input space: every caller
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
  summarizeOffer,
} from '@libs/billing/root/client/billing-view-model';
import fc from 'fast-check';

import {
  CALLERS,
  type Caller,
  DAY,
  inputFor,
  MEMBER_KINDS,
  NOW,
  PAST_END,
  PERIOD_END,
  ROW_KINDS,
  type RowKind,
  row,
  UNLOCK_LABEL,
} from './support/billing-matrix';

const KINDS = Object.keys(ROW_KINDS) as RowKind[];

const FC = { numRuns: 300, seed: 424_242 } as const;

type Expected = {
  readonly tier: BillingTier;
  readonly state: MembershipState;
  readonly primary: BillingPrimaryAction;
  readonly notice: BillingNotice | null;
};

/** Billing on: what an account sees, per row. */
const ACCOUNT: Record<RowKind, Expected> = {
  none: { tier: 'free', state: 'none', primary: 'subscribe', notice: null },
  incomplete: {
    tier: 'free',
    state: 'incomplete',
    primary: 'subscribe',
    notice: 'incomplete',
  },
  trialing: { tier: 'paid', state: 'trialing', primary: 'none', notice: null },
  active: { tier: 'paid', state: 'active', primary: 'none', notice: null },
  canceling: {
    tier: 'paid',
    state: 'canceling',
    primary: 'none',
    notice: null,
  },
  delinquent: {
    tier: 'paid',
    state: 'delinquent',
    primary: 'none',
    notice: 'delinquent',
  },
  ended: { tier: 'free', state: 'ended', primary: 'subscribe', notice: null },
};

function expected(
  caller: Caller,
  kind: RowKind,
  billingEnabled: boolean
): Expected {
  if (caller === 'guest') {
    return billingEnabled
      ? { tier: 'free', state: 'none', primary: 'unlock', notice: null }
      : { tier: 'free', state: 'none', primary: 'none', notice: 'unavailable' };
  }
  const account = ACCOUNT[kind];
  return billingEnabled
    ? account
    : { ...account, primary: 'none', notice: 'unavailable' };
}

describe('billing view: every caller × row × switch × customer', () => {
  for (const caller of CALLERS) {
    for (const kind of KINDS) {
      for (const enabled of [true, false]) {
        for (const hasCustomer of [true, false]) {
          const name = `${caller} · ${kind} · billing ${enabled ? 'on' : 'off'} · ${hasCustomer ? 'customer' : 'no customer'}`;
          test(name, () => {
            const view = buildBillingView(
              inputFor(caller, kind, enabled, hasCustomer)
            );
            expect({
              tier: view.tier,
              state: view.state,
              primary: view.primary,
              notice: view.notice,
            }).toEqual(expected(caller, kind, enabled));
            expect(view.unlockLabel).toBe(
              view.primary === 'unlock' ? UNLOCK_LABEL : null
            );
            expect(view.manage).toBe(
              enabled && caller === 'account' && hasCustomer
            );
            expect(view.showPricing).toBe(enabled);
          });
        }
      }
    }
  }
});

describe('billing view: grace', () => {
  test('an ended membership stays paid through its grace period', () => {
    const input = inputFor('account', 'ended', true, true);
    expect(buildBillingView({ ...input, graceMs: 4 * DAY }).tier).toBe('paid');
    expect(buildBillingView({ ...input, graceMs: 2 * DAY }).tier).toBe('free');
  });

  test('every member row reads as paid', () => {
    for (const kind of MEMBER_KINDS) {
      expect(buildBillingView(inputFor('account', kind, true, true)).tier).toBe(
        'paid'
      );
    }
  });
});

describe('billing view: dates', () => {
  test('a trial counts whole days down to its end', () => {
    const view = buildBillingView(inputFor('account', 'trialing', true, true));
    expect(view.periodEndMs).toBe(Date.parse(PERIOD_END));
    expect(view.daysLeft).toBe(10);
  });

  test('an end in the past has no days left', () => {
    const view = buildBillingView(inputFor('account', 'ended', true, true));
    expect(view.periodEndMs).toBe(Date.parse(PAST_END));
    expect(view.daysLeft).toBeNull();
  });

  test('an incomplete checkout has no date', () => {
    const view = buildBillingView(
      inputFor('account', 'incomplete', true, true)
    );
    expect(view.periodEndMs).toBeNull();
    expect(view.priceKey).toBe('subscription_monthly');
  });

  test('a trialing row set to cancel reads as canceling', () => {
    const view = buildBillingView({
      ...inputFor('account', 'trialing', true, true),
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
  canView: fc.boolean(),
  canSubscribe: fc.boolean(),
  canManage: fc.boolean(),
  subscribeUnlockLabel: fc.option(fc.constant(UNLOCK_LABEL), { nil: null }),
  hasCustomer: fc.boolean(),
  row: arbRow,
  nowMs: fc.constant(NOW),
  graceMs: fc.constantFrom(0, 7 * DAY),
});

describe('billing view: properties over arbitrary rows', () => {
  test('without the manage grant no membership is shown or managed', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView({ ...input, canManage: false });
        expect(view.state).toBe('none');
        expect(view.tier).toBe('free');
        expect(view.manage).toBe(false);
      }),
      FC
    );
  });

  test('a denied subscribe offers its unlock, and only then', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView(input);
        if (view.primary !== 'unlock') return;
        expect(input.canSubscribe).toBe(false);
        expect(view.unlockLabel).toBe(input.subscribeUnlockLabel);
      }),
      FC
    );
  });

  test('a paying member is never offered a second checkout', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView(input);
        if (view.tier === 'paid') expect(view.primary).toBe('none');
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
        expect(view.notice).toBe(input.canView ? 'delinquent' : 'unavailable');
      }),
      FC
    );
  });

  test('billing off offers nothing', () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        const view = buildBillingView({ ...input, canView: false });
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
