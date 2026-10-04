import { describe, expect, test } from 'bun:test';
import type { AccessInputs } from '@libs/permissions-shared/access-facts';
import {
  governingSubscription,
  readSubscriptionSnapshot,
} from '@libs/permissions-shared/access-facts';
import { resolvePlanRole } from '@libs/permissions-shared/access-model';
import { ROLE } from '@libs/permissions-shared/permission-catalog';

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function facts(overrides: Partial<AccessInputs>): AccessInputs {
  return {
    signedIn: true,
    subscription: null,
    nowMs: 1_000,
    graceMs: GRACE_MS,
    confirmedAtMs: null,
    billingEnabled: true,
    ...overrides,
  };
}

describe('governingSubscription', () => {
  const row = (status: string, end: string) => ({
    status,
    current_period_end: end,
    cancel_at_period_end: 0,
  });

  test('a live membership at one provider outranks a newer ended one at another', () => {
    // Newest first: the old provider's late "ended" callback came in last.
    const snapshot = governingSubscription([
      row('ended', '2026-12-01T00:00:00.000Z'),
      row('active', '2026-10-01T00:00:00.000Z'),
    ]);
    expect(snapshot?.status).toBe('active');
  });

  test('unreadable rows grant nothing and hide nothing', () => {
    expect(
      governingSubscription([row('past_due', '2026-10-01T00:00:00.000Z')])
    ).toBeNull();
    expect(
      governingSubscription([
        row('mystery', '2027-01-01T00:00:00.000Z'),
        row('trialing', '2026-10-01T00:00:00.000Z'),
      ])?.status
    ).toBe('trialing');
  });

  test('no rows, no membership', () => {
    expect(governingSubscription([])).toBeNull();
  });
});

describe('readSubscriptionSnapshot', () => {
  test('an absent, blank or unknown status is no subscription', () => {
    expect(readSubscriptionSnapshot(undefined)).toBeNull();
    for (const status of ['', null, 'mystery', 'past_due']) {
      expect(
        readSubscriptionSnapshot({
          status,
          current_period_end: null,
          cancel_at_period_end: null,
        })
      ).toBeNull();
    }
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
    for (const flag of [1, true]) {
      expect(
        readSubscriptionSnapshot({ ...base, cancel_at_period_end: flag })
          ?.cancelAtPeriodEnd
      ).toBe(true);
    }
    for (const flag of [0, null]) {
      expect(
        readSubscriptionSnapshot({ ...base, cancel_at_period_end: flag })
          ?.cancelAtPeriodEnd
      ).toBe(false);
    }
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
    for (const status of ['active', 'trialing'] as const) {
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

  // regression: offline-member-kept-paid-forever
  test('a member offline six days is paid; eight days, free; back online, paid', () => {
    const day = 24 * 60 * 60 * 1000;
    const offlineSince = 1_000;
    const member = facts({
      subscription: {
        status: 'trialing',
        currentPeriodEndMs: offlineSince + 7 * day,
        cancelAtPeriodEnd: false,
      },
      confirmedAtMs: offlineSince,
    });
    expect(resolvePlanRole({ ...member, nowMs: offlineSince + 6 * day })).toBe(
      ROLE.planPaid
    );
    expect(resolvePlanRole({ ...member, nowMs: offlineSince + 8 * day })).toBe(
      ROLE.planFree
    );
    expect(
      resolvePlanRole({
        ...member,
        nowMs: offlineSince + 8 * day,
        confirmedAtMs: offlineSince + 8 * day,
      })
    ).toBe(ROLE.planPaid);
  });

  test('an ended plan keeps paid access through the grace window', () => {
    const subscription = {
      status: 'ended',
      currentPeriodEndMs: 1_000,
      cancelAtPeriodEnd: false,
    } as const;
    expect(
      resolvePlanRole(facts({ subscription, nowMs: 1_000 + GRACE_MS }))
    ).toBe(ROLE.planPaid);
    expect(
      resolvePlanRole(facts({ subscription, nowMs: 1_000 + GRACE_MS + 1 }))
    ).toBe(ROLE.planFree);
  });

  test('a delinquent plan gets the same grace window as an ended one', () => {
    for (const status of ['delinquent', 'ended'] as const) {
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
            status: 'ended',
            currentPeriodEndMs: null,
            cancelAtPeriodEnd: false,
          },
        })
      )
    ).toBe(ROLE.planFree);
  });

  test('an incomplete plan is free even inside its period', () => {
    expect(
      resolvePlanRole(
        facts({
          subscription: {
            status: 'incomplete',
            currentPeriodEndMs: 1_000 + GRACE_MS,
            cancelAtPeriodEnd: false,
          },
        })
      )
    ).toBe(ROLE.planFree);
  });
});
