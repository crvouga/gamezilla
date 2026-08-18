import { describe, expect, test } from 'bun:test';

import { canonicalUserPair, otherUserInPair } from './canonical-pair';

describe('canonicalUserPair', () => {
  test('orders ids lexicographically', () => {
    const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    expect(canonicalUserPair(b, a)).toEqual({ userLow: a, userHigh: b });
  });
});

describe('otherUserInPair', () => {
  test('returns the opposite user', () => {
    const low = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const high = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    expect(otherUserInPair(low, high, low)).toBe(high);
    expect(otherUserInPair(low, high, high)).toBe(low);
  });
});
