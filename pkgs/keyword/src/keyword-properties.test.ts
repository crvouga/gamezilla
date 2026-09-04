import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { asKeyword, isNamespacedKeyword, joinKeywordSegments } from './keyword';
import {
  arbKebabSegment,
  arbNamespacedKeyword,
} from './test/keyword-arbitraries';

describe('keyword properties', () => {
  test('constructed namespaced keywords are accepted', () => {
    assertProperty(
      'arbNamespacedKeyword ⇒ isNamespacedKeyword',
      fc.property(arbNamespacedKeyword(), (key) => {
        expect(isNamespacedKeyword(key)).toBe(true);
        expect(asKeyword(key) as string).toBe(key);
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
