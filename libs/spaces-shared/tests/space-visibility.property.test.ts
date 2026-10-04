import { describe, expect, test } from 'bun:test';
import type { SpaceVisibility } from '@libs/spaces-shared/space-visibility';
import {
  isSpaceVisibility,
  parseSpaceVisibility,
  SPACE_VISIBILITIES,
} from '@libs/spaces-shared/space-visibility';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const arbVisibility = fc.constantFrom<SpaceVisibility>(...SPACE_VISIBILITIES);
const arbAnything = fc.oneof(
  fc.anything(),
  fc.string(),
  arbVisibility,
  fc.constantFrom('friends', 'Public', ' public', 'PRIVATE')
);

describe('space visibility', () => {
  test('pins the visibility vocabulary', () => {
    expect(SPACE_VISIBILITIES).toEqual(['public', 'private']);
  });

  test('isSpaceVisibility accepts exactly the vocabulary', () => {
    assertProperty(
      'isSpaceVisibility iff member',
      fc.property(arbAnything, (value) => {
        expect(isSpaceVisibility(value)).toBe(
          (SPACE_VISIBILITIES as readonly unknown[]).includes(value)
        );
      })
    );
  });

  test('parse keeps a valid value and falls back otherwise (private by default)', () => {
    assertProperty(
      'parse = identity | fallback',
      fc.property(
        arbAnything,
        fc.option(arbVisibility, { nil: undefined }),
        (value, fallback) => {
          const parsed = parseSpaceVisibility(value, fallback);
          const expected = isSpaceVisibility(value)
            ? value
            : (fallback ?? 'private');
          expect(parsed).toBe(expected);
          expect(parseSpaceVisibility(parsed, fallback)).toBe(parsed);
        }
      )
    );
  });
});
