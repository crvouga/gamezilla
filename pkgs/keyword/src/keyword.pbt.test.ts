import { describe, expect, test } from 'bun:test';
import {
  arbKebabSegment,
  arbNamespacedKeyword,
  assertProperty,
  fc,
} from '@pkgs/pbt';

import { asKeyword, isNamespacedKeyword, joinKeywordSegments } from './keyword';

describe('keyword properties', () => {
  test('constructed namespaced keywords are accepted', () => {
    assertProperty(
      'arbNamespacedKeyword ⇒ isNamespacedKeyword',
      fc.property(arbNamespacedKeyword(), (key) => {
        expect(isNamespacedKeyword(key)).toBe(true);
        expect(asKeyword(key)).toBe(key);
      })
    );
  });

  test('joinKeywordSegments + local yields a valid keyword', () => {
    assertProperty(
      'joinKeywordSegments round-trip',
      fc.property(
        fc.array(arbKebabSegment(), { minLength: 1, maxLength: 3 }),
        arbKebabSegment(),
        (ns, local) => {
          const prefix = joinKeywordSegments(...ns);
          expect(isNamespacedKeyword(`${prefix}/${local}`)).toBe(true);
        }
      )
    );
  });

  test('uppercase and empty are rejected', () => {
    assertProperty(
      'invalid keywords rejected',
      fc.property(
        fc.constantFrom(
          '',
          'NoSlash',
          'UPPER/case',
          'a/B',
          'ns/',
          '/local',
          'ns//local'
        ),
        (bad) => {
          expect(isNamespacedKeyword(bad)).toBe(false);
        }
      )
    );
  });
});
