import { describe, expect, test } from 'bun:test';

import { parseDuckdbVersion } from './duckdb';

describe('parseDuckdbVersion', () => {
  test('parses v-prefixed CLI --version output', () => {
    expect(parseDuckdbVersion('v1.5.4 1f98600c2c')).toBe('1.5.4');
  });

  test('parses bare semver', () => {
    expect(parseDuckdbVersion('1.4.0')).toBe('1.4.0');
  });

  test('returns null for unrelated text', () => {
    expect(parseDuckdbVersion('not a version string')).toBeNull();
  });
});
