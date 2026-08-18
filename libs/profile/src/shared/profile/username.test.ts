import { describe, expect, test } from 'bun:test';

import {
  canChangeUsername,
  USERNAME_CHANGE_COOLDOWN_MS,
  validateUsername,
} from './username';

describe('validateUsername', () => {
  test('accepts valid handles', () => {
    expect(validateUsername('abc')).toBeNull();
    expect(validateUsername('Player_1')).toBeNull();
  });

  test('rejects invalid handles', () => {
    expect(validateUsername('ab')).toBe('too_short');
    expect(validateUsername('bad-name')).toBe('invalid_format');
    expect(validateUsername('')).toBe('empty');
  });
});

describe('canChangeUsername', () => {
  const nowMs = 1_700_000_000_000;

  test('allows first change', () => {
    expect(canChangeUsername(null, nowMs)).toBe(true);
    expect(canChangeUsername('', nowMs)).toBe(true);
  });

  test('enforces cooldown', () => {
    const now = nowMs;
    const recent = new Date(
      now - USERNAME_CHANGE_COOLDOWN_MS + 1000
    ).toISOString();
    expect(canChangeUsername(recent, now)).toBe(false);
  });
});
