import { describe, expect, test } from 'bun:test';

import {
  USERNAME_CHANGE_COOLDOWN_MS,
  canChangeUsername,
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
  test('allows first change', () => {
    expect(canChangeUsername(null)).toBe(true);
    expect(canChangeUsername('')).toBe(true);
  });

  test('enforces cooldown', () => {
    const now = Date.now();
    const recent = new Date(now - USERNAME_CHANGE_COOLDOWN_MS + 1000).toISOString();
    expect(canChangeUsername(recent, now)).toBe(false);
  });
});
