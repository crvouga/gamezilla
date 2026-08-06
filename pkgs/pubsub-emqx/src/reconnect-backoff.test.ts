import { describe, expect, test } from 'bun:test';
import { fullJitterDelayMs, randomClientIdSuffix } from './reconnect-backoff';

describe('fullJitterDelayMs', () => {
  test('stays within [0, cap]', () => {
    for (let i = 0; i < 50; i++) {
      const d = fullJitterDelayMs(i, 100, 5000, () => 0.999);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(5000);
    }
  });

  test('zero random yields zero', () => {
    expect(fullJitterDelayMs(3, 100, 5000, () => 0)).toBe(0);
  });
});

describe('randomClientIdSuffix', () => {
  test('returns non-empty string', () => {
    expect(randomClientIdSuffix(() => 0.5).length).toBeGreaterThan(0);
  });
});
