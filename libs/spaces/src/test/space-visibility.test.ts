import { describe, expect, test } from 'bun:test';

import {
  isSpaceVisibility,
  parseSpaceVisibility,
} from '../shared/space-visibility';

describe('space visibility', () => {
  test('parses known values', () => {
    expect(isSpaceVisibility('public')).toBe(true);
    expect(isSpaceVisibility('friends')).toBe(true);
    expect(isSpaceVisibility('private')).toBe(true);
    expect(isSpaceVisibility('secret')).toBe(false);
  });

  test('falls back to private', () => {
    expect(parseSpaceVisibility(null)).toBe('private');
    expect(parseSpaceVisibility('nope')).toBe('private');
    expect(parseSpaceVisibility('public')).toBe('public');
  });
});
