// goal:guest-free-and-paid:10
// goal:always-true:4
// goal:always-true:5
import { describe, expect, test } from 'bun:test';
import { ROLE } from '@libs/permissions/public/permission-catalog';
import {
  type PlanFacts,
  readSubscriptionSnapshot,
  resolvePlanRole,
} from '@libs/permissions/public/plan';

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function facts(overrides: Partial<PlanFacts>): PlanFacts {
  return {
    signedIn: true,
    subscription: null,
    nowMs: 1_000,
    graceMs: GRACE_MS,
    ...overrides,
  };
}

describe('readSubscriptionSnapshot', () => {
  test('an absent row or blank status is no subscription', () => {
    expect(readSubscriptionSnapshot(undefined)).toBeNull();
    expect(
      readSubscriptionSnapshot({
        status: '',
        current_period_end: null,
        cancel_at_period_end: null,
      })
    ).toBeNull();
    expect(
      readSubscriptionSnapshot({
        status: null,
        current_period_end: null,
        cancel_at_period_end: null,
      })
    ).toBeNull();
  });

  test('an unparsable period end becomes null', () => {
    const snapshot = readSubscriptionSnapshot({
      status: 'active',
      current_period_end: 'not-a-date',
      cancel_at_period_end: 0,
    });
    expect(snapshot).toEqual({
      status: 'active',
      currentPeriodEndMs: null,
      cancelAtPeriodEnd: false,
    });
  });

  test('sqlite 0/1 and postgres booleans both decode', () => {
    const base = { status: 'active', current_period_end: null };
    expect(
      readSubscriptionSnapshot({ ...base, cancel_at_period_end: 1 })
        ?.cancelAtPeriodEnd
    ).toBe(true);
    expect(
      readSubscriptionSnapshot({ ...base, cancel_at_period_end: true })
        ?.cancelAtPeriodEnd
    ).toBe(true);
    expect(
      readSubscriptionSnapshot({ ...base, cancel_at_period_end: 0 })
        ?.cancelAtPeriodEnd
    ).toBe(false);
    expect(
      readSubscriptionSnapshot({ ...base, cancel_at_period_end: null })
        ?.cancelAtPeriodEnd
    ).toBe(false);
  });
});

describe('resolvePlanRole', () => {
  test('signed out is always a guest', () => {
    expect(
      resolvePlanRole(
        facts({
          signedIn: false,
          subscription: {
            status: 'active',
            currentPeriodEndMs: null,
            cancelAtPeriodEnd: false,
          },
        })
      )
    ).toBe(ROLE.planGuest);
  });

  test('signed in without a plan is free', () => {
    expect(resolvePlanRole(facts({ subscription: null }))).toBe(ROLE.planFree);
  });

  test('an active or trialing plan is paid', () => {
    for (const status of ['active', 'trialing']) {
      expect(
        resolvePlanRole(
          facts({
            subscription: {
              status,
              currentPeriodEndMs: null,
              cancelAtPeriodEnd: false,
            },
          })
        )
      ).toBe(ROLE.planPaid);
    }
  });

  test('an ended plan keeps paid access through the grace window', () => {
    const subscription = {
      status: 'canceled',
      currentPeriodEndMs: 1_000,
      cancelAtPeriodEnd: false,
    };
    expect(
      resolvePlanRole(facts({ subscription, nowMs: 1_000 + GRACE_MS }))
    ).toBe(ROLE.planPaid);
    expect(
      resolvePlanRole(facts({ subscription, nowMs: 1_000 + GRACE_MS + 1 }))
    ).toBe(ROLE.planFree);
  });

  test('every ended status gets the same grace window', () => {
    for (const status of ['unpaid', 'past_due', 'incomplete_expired']) {
      expect(
        resolvePlanRole(
          facts({
            subscription: {
              status,
              currentPeriodEndMs: 1_000,
              cancelAtPeriodEnd: false,
            },
            nowMs: 1_000 + GRACE_MS,
          })
        )
      ).toBe(ROLE.planPaid);
    }
  });

  test('an ended plan without a period end is free', () => {
    expect(
      resolvePlanRole(
        facts({
          subscription: {
            status: 'canceled',
            currentPeriodEndMs: null,
            cancelAtPeriodEnd: false,
          },
        })
      )
    ).toBe(ROLE.planFree);
  });

  test('an unknown status is free', () => {
    expect(
      resolvePlanRole(
        facts({
          subscription: {
            status: 'mystery',
            currentPeriodEndMs: 1_000,
            cancelAtPeriodEnd: false,
          },
        })
      )
    ).toBe(ROLE.planFree);
  });
});
