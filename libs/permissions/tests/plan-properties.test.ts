/**
 * Properties of the plan resolver over arbitrary snapshots, clocks and grace
 * windows — the laws the enumerated state space (`plan-state-space.test.ts`)
 * samples at fixed points.
 */
import { describe, expect, test } from 'bun:test';
import {
  type AccessInputs,
  ROLE,
  readSubscriptionSnapshot,
  resolvePlanRole,
  type SubscriptionSnapshot,
} from '@libs/permissions/root/access-model';
import type { MembershipStatus } from '@pkgs/billing';
import fc from 'fast-check';

const PARAMS = { seed: 424_242, numRuns: 400 } as const;
const DAY = 86_400_000;
const T0 = Date.parse('2026-01-01T00:00:00.000Z');

const statusArb = fc.constantFrom<MembershipStatus>(
  'incomplete',
  'trialing',
  'active',
  'delinquent',
  'ended'
);
const msArb = fc.integer({ min: T0, max: T0 + 800 * DAY });
const graceArb = fc.integer({ min: 0, max: 30 * DAY });

const snapshotArb: fc.Arbitrary<SubscriptionSnapshot> = fc.record({
  status: statusArb,
  currentPeriodEndMs: fc.option(msArb, { nil: null }),
  cancelAtPeriodEnd: fc.boolean(),
});

const factsArb: fc.Arbitrary<AccessInputs> = fc.record({
  signedIn: fc.boolean(),
  subscription: fc.option(snapshotArb, { nil: null }),
  nowMs: msArb,
  graceMs: graceArb,
  billingEnabled: fc.boolean(),
});

describe('plan resolver properties', () => {
  test('signed out is always a guest; a guest is always signed out', () => {
    fc.assert(
      fc.property(factsArb, (facts) => {
        const role = resolvePlanRole(facts);
        expect(role === ROLE.planGuest).toBe(!facts.signedIn);
      }),
      PARAMS
    );
  });

  test('paid implies signed in with a readable membership', () => {
    fc.assert(
      fc.property(factsArb, (facts) => {
        if (resolvePlanRole(facts) !== ROLE.planPaid) return;
        expect(facts.signedIn).toBe(true);
        expect(facts.subscription).not.toBeNull();
      }),
      PARAMS
    );
  });

  test('an incomplete membership never grants', () => {
    fc.assert(
      fc.property(factsArb, snapshotArb, (facts, snapshot) => {
        const subscription = { ...snapshot, status: 'incomplete' as const };
        expect(resolvePlanRole({ ...facts, subscription })).not.toBe(
          ROLE.planPaid
        );
      }),
      PARAMS
    );
  });

  test('a status outside our vocabulary reads as no membership', () => {
    const known = new Set([
      'incomplete',
      'trialing',
      'active',
      'delinquent',
      'ended',
    ]);
    fc.assert(
      fc.property(
        fc.string().filter((s) => !known.has(s)),
        fc.option(fc.string(), { nil: null }),
        (status, end) => {
          expect(
            readSubscriptionSnapshot({
              status,
              current_period_end: end,
              cancel_at_period_end: 1,
            })
          ).toBeNull();
        }
      ),
      PARAMS
    );
  });

  test('for one row, access is monotone in time: once lost, never regained', () => {
    fc.assert(
      fc.property(factsArb, msArb, msArb, (facts, a, b) => {
        const [early, late] = a <= b ? [a, b] : [b, a];
        const paidLate =
          resolvePlanRole({ ...facts, nowMs: late }) === ROLE.planPaid;
        const paidEarly =
          resolvePlanRole({ ...facts, nowMs: early }) === ROLE.planPaid;
        if (paidLate) expect(paidEarly).toBe(true);
      }),
      PARAMS
    );
  });

  test('delinquent and ended grant exactly through end + grace, inclusive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<MembershipStatus>('delinquent', 'ended'),
        msArb,
        graceArb,
        fc.boolean(),
        (status, end, graceMs, cancelAtPeriodEnd) => {
          const base: AccessInputs = {
            signedIn: true,
            subscription: {
              status,
              currentPeriodEndMs: end,
              cancelAtPeriodEnd,
            },
            nowMs: end + graceMs,
            graceMs,
            billingEnabled: true,
          };
          expect(resolvePlanRole(base)).toBe(ROLE.planPaid);
          expect(resolvePlanRole({ ...base, nowMs: end + graceMs + 1 })).toBe(
            ROLE.planFree
          );
        }
      ),
      PARAMS
    );
  });

  test('the cancel flag never changes the role', () => {
    fc.assert(
      fc.property(factsArb, snapshotArb, (facts, snapshot) => {
        const with_ = {
          ...facts,
          subscription: { ...snapshot, cancelAtPeriodEnd: true },
        };
        const without = {
          ...facts,
          subscription: { ...snapshot, cancelAtPeriodEnd: false },
        };
        expect(resolvePlanRole(with_)).toBe(resolvePlanRole(without));
      }),
      PARAMS
    );
  });

  test('a longer grace window never takes access away', () => {
    fc.assert(
      fc.property(factsArb, graceArb, (facts, extra) => {
        if (resolvePlanRole(facts) !== ROLE.planPaid) return;
        expect(
          resolvePlanRole({ ...facts, graceMs: facts.graceMs + extra })
        ).toBe(ROLE.planPaid);
      }),
      PARAMS
    );
  });
});
