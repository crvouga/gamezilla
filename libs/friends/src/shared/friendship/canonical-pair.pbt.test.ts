import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { arbDistinctUserPair } from '../../test/arbitraries/user-pair';

import { canonicalUserPair, otherUserInPair } from './canonical-pair';

describe('canonicalUserPair properties', () => {
  test('pair is commutative', () => {
    assertProperty(
      'canonicalUserPair(a,b) === canonicalUserPair(b,a)',
      fc.property(arbDistinctUserPair(), ([a, b]) => {
        expect(canonicalUserPair(a, b)).toEqual(canonicalUserPair(b, a));
      })
    );
  });

  test('otherUserInPair is an inverse on the pair', () => {
    assertProperty(
      'otherUserInPair inverse',
      fc.property(arbDistinctUserPair(), ([a, b]) => {
        const { userLow, userHigh } = canonicalUserPair(a, b);
        expect(otherUserInPair(userLow, userHigh, userLow)).toBe(userHigh);
        expect(otherUserInPair(userLow, userHigh, userHigh)).toBe(userLow);
        expect(otherUserInPair(userLow, userHigh, 'not-in-pair')).toBeNull();
      })
    );
  });
});
