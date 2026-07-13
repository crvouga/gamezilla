import { describe, expect, test } from 'bun:test';

import { generateRandomUsername } from './username-generator';
import { validateUsername } from './username';

describe('generateRandomUsername', () => {
  test('returns a non-empty valid username', () => {
    const name = generateRandomUsername();
    expect(name.length).toBeGreaterThan(0);
    expect(validateUsername(name)).toBeNull();
  });

  test('is deterministic for the same seed', () => {
    const a = generateRandomUsername(42_424);
    const b = generateRandomUsername(42_424);
    expect(a).toBe(b);
  });

  test('varies by seed attempt for collision retries', () => {
    const a = generateRandomUsername('user-id:0');
    const b = generateRandomUsername('user-id:1');
    expect(a).not.toBe(b);
  });
});
