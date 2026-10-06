import { describe, expect, test } from 'bun:test';
import { isValidSignupUsername } from '@libs/auth-shared/signup-username';
import {
  createAppModeration,
  SHIPPED_TEAM_RULES,
} from '@libs/moderation-shared/policy';

const moderation = createAppModeration(SHIPPED_TEAM_RULES);

describe('isValidSignupUsername', () => {
  test('accepts 3-32 letter number underscore handles', () => {
    expect(isValidSignupUsername('abc', moderation)).toBe(true);
    expect(isValidSignupUsername('Alice_1', moderation)).toBe(true);
  });

  test('rejects empty short long and punctuation', () => {
    expect(isValidSignupUsername('  ', moderation)).toBe(false);
    expect(isValidSignupUsername('ab', moderation)).toBe(false);
    expect(isValidSignupUsername('a'.repeat(33), moderation)).toBe(false);
    expect(isValidSignupUsername('alice-1', moderation)).toBe(false);
  });
});
