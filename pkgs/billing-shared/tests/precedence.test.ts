import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

import type { MembershipStatus } from '@pkgs/billing-shared/membership';
import { governingMembership, membershipAccessLapsesAtMs, membershipGrantsAccess, outranksMembership, readMembershipStatus } from '@pkgs/billing-shared/precedence';
import type { MembershipStanding } from '@pkgs/billing-shared/precedence';

const STATUSES: readonly (MembershipStatus | null)[] = [
  'active',
  'trialing',
  'delinquent',
  'incomplete',
  'ended',
  null,
];

const standing = fc.record({
  status: fc.constantFrom(...STATUSES),
  periodEndMs: fc.option(fc.integer({ min: 0, max: 1_000 }), { nil: null }),
});

const self = (s: MembershipStanding) => s;

describe('governingMembership', () => {
  test('a live membership at one provider outranks an ended one at another', () => {
    const endedLate = { status: 'ended' as const, periodEndMs: 900 };
    const live = { status: 'active' as const, periodEndMs: 100 };
    expect(governingMembership([endedLate, live], self)).toBe(live);
    expect(governingMembership([live, endedLate], self)).toBe(live);
  });

  test('paid outranks a trial, whatever the order', () => {
    const trial = { status: 'trialing' as const, periodEndMs: null };
    const paid = { status: 'active' as const, periodEndMs: null };
    expect(governingMembership([trial, paid], self)).toBe(paid);
    expect(governingMembership([paid, trial], self)).toBe(paid);
  });

  test('none of an empty list', () => {
    expect(governingMembership([], self)).toBeNull();
  });

  test('the answer does not depend on row order, up to full ties', () => {
    assertProperty(
      'the answer does not depend on row order, up to full ties',
      fc.property(
        fc.array(standing, { minLength: 1, maxLength: 6 }),
        (rows) => {
          const forward = governingMembership(rows, self);
          const backward = governingMembership([...rows].reverse(), self);
          expect(forward).toEqual(backward);
        }
      ),
      { numRuns: 1000 }
    );
  });

  test('nothing in the list outranks the answer', () => {
    assertProperty(
      'nothing in the list outranks the answer',
      fc.property(
        fc.array(standing, { minLength: 1, maxLength: 6 }),
        (rows) => {
          const best = governingMembership(rows, self);
          if (best === null) throw new Error('non-empty list');
          for (const row of rows) {
            expect(outranksMembership(row, best)).toBe(false);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});

describe('readMembershipStatus', () => {
  test('reads our words and nothing else', () => {
    for (const status of STATUSES) {
      if (status !== null) expect(readMembershipStatus(status)).toBe(status);
    }
    for (const other of ['past_due', 'canceled', '', null, undefined]) {
      expect(readMembershipStatus(other)).toBeNull();
    }
  });
});

describe('membershipGrantsAccess', () => {
  const at = { nowMs: 1_000, graceMs: 100, confirmedAtMs: null };

  test('active and trialing grant whatever the period says', () => {
    for (const status of ['active', 'trialing'] as const) {
      expect(membershipGrantsAccess({ status, periodEndMs: null }, at)).toBe(
        true
      );
      expect(membershipGrantsAccess({ status, periodEndMs: 0 }, at)).toBe(true);
    }
  });

  test('delinquent and ended grant until period end plus grace', () => {
    for (const status of ['delinquent', 'ended'] as const) {
      expect(membershipGrantsAccess({ status, periodEndMs: 900 }, at)).toBe(
        true
      );
      expect(membershipGrantsAccess({ status, periodEndMs: 899 }, at)).toBe(
        false
      );
      expect(membershipGrantsAccess({ status, periodEndMs: null }, at)).toBe(
        false
      );
    }
  });

  test('nothing grants once the membership went unconfirmed past grace', () => {
    for (const status of [
      'active',
      'trialing',
      'delinquent',
      'ended',
    ] as const) {
      const standing = { status, periodEndMs: 1_000 };
      expect(
        membershipGrantsAccess(standing, { ...at, confirmedAtMs: 900 })
      ).toBe(true);
      expect(
        membershipGrantsAccess(standing, { ...at, confirmedAtMs: 899 })
      ).toBe(false);
    }
  });

  test('access lapses at the earlier of period end and confirmation, plus grace', () => {
    expect(
      membershipAccessLapsesAtMs(
        { status: 'trialing', periodEndMs: 5_000 },
        { ...at, confirmedAtMs: 950 }
      )
    ).toBe(1_051);
    expect(
      membershipAccessLapsesAtMs(
        { status: 'ended', periodEndMs: 920 },
        { ...at, confirmedAtMs: 1_000 }
      )
    ).toBe(1_021);
    expect(
      membershipAccessLapsesAtMs({ status: 'active', periodEndMs: 920 }, at)
    ).toBeNull();
    expect(
      membershipAccessLapsesAtMs({ status: 'ended', periodEndMs: null }, at)
    ).toBeNull();
  });

  test('lapse time agrees with the access answer', () => {
    assertProperty(
      'lapse time agrees with the access answer',
      fc.property(
        standing,
        fc.integer({ min: 0, max: 2_000 }),
        fc.option(fc.integer({ min: 0, max: 2_000 }), { nil: null }),
        (s, nowMs, confirmedAtMs) => {
          const moment = { nowMs, graceMs: 100, confirmedAtMs };
          const lapses = membershipAccessLapsesAtMs(s, moment);
          if (lapses === null) return;
          expect(membershipGrantsAccess(s, moment)).toBe(true);
          expect(
            membershipGrantsAccess(s, { ...moment, nowMs: lapses - 1 })
          ).toBe(true);
          expect(membershipGrantsAccess(s, { ...moment, nowMs: lapses })).toBe(
            false
          );
        }
      )
    );
  });

  test('incomplete and unreadable never grant', () => {
    assertProperty(
      'incomplete and unreadable never grant',
      fc.property(standing, (s) => {
        if (s.status !== 'incomplete' && s.status !== null) return;
        expect(membershipGrantsAccess(s, at)).toBe(false);
      })
    );
  });
});
