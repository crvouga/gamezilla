import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property';
import fc from 'fast-check';

import type { MembershipStatus } from './membership';
import {
  governingMembership,
  type MembershipStanding,
  membershipGrantsAccess,
  outranksMembership,
  readMembershipStatus,
} from './precedence';

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
  const at = { nowMs: 1_000, graceMs: 100 };

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
