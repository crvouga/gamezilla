import { describe, expect, test } from 'bun:test';

import {
  formatUsdCents,
  membershipStatusKind,
  subscriptionEntitled,
} from '@libs/billing/public/subscription';

const ROW = {
  status: 'active',
  trial_end: null,
  current_period_end: '2026-02-01T00:00:00.000Z',
  grace_until: null,
};

describe('subscription entitlement', () => {
  test('active access ends at the period boundary', () => {
    const end = Date.parse(ROW.current_period_end);
    expect(subscriptionEntitled(ROW, end - 1)).toBe(true);
    expect(subscriptionEntitled(ROW, end)).toBe(false);
    expect(subscriptionEntitled(null, end)).toBe(false);
  });

  test('maps a row into the membership label the screen shows', () => {
    expect(membershipStatusKind(null, false)).toBe('none');
    expect(membershipStatusKind('trialing', true)).toBe('trial');
    expect(membershipStatusKind('active', true)).toBe('active');
    expect(membershipStatusKind('past_due', true)).toBe('past_due');
    expect(membershipStatusKind('active', false)).toBe('expired');
    expect(membershipStatusKind('incomplete', false)).toBe('incomplete');
  });

  test('formats catalog cents as dollars', () => {
    expect(formatUsdCents(700)).toBe('$7.00');
    expect(formatUsdCents(6000)).toBe('$60.00');
  });
});
