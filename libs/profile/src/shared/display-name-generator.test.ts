import { describe, expect, test } from 'bun:test';

import { generateRandomDisplayName } from './display-name-generator';

/** Adjective + animal + exactly three digits, no separators. */
const DISPLAY_NAME_RE = /^[A-Z][a-zA-Z]*[A-Z][a-zA-Z]*\d{3}$/;

describe('generateRandomDisplayName', () => {
  test('matches expected shape over many random draws', () => {
    for (let i = 0; i < 120; i += 1) {
      const name = generateRandomDisplayName();
      expect(name).toMatch(DISPLAY_NAME_RE);
    }
  });

  test('is deterministic for a fixed seed', () => {
    const a = generateRandomDisplayName(42_424);
    const b = generateRandomDisplayName(42_424);
    expect(a).toBe(b);
    expect(a).toMatch(DISPLAY_NAME_RE);
  });
});
