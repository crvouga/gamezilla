import { describe, expect, test } from 'bun:test';
import { isValidSignupUsername } from '@libs/auth-shared/signup-username';

describe('isValidSignupUsername', () => {
  test('accepts 3-32 letter number underscore handles', () => {
    expect(isValidSignupUsername('abc')).toBe(true);
    expect(isValidSignupUsername('Alice_1')).toBe(true);
  });

  test('rejects empty short long and punctuation', () => {
    expect(isValidSignupUsername('  ')).toBe(false);
    expect(isValidSignupUsername('ab')).toBe(false);
    expect(isValidSignupUsername('a'.repeat(33))).toBe(false);
    expect(isValidSignupUsername('alice-1')).toBe(false);
  });
});
