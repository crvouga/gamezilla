import { expect, test } from 'bun:test';
import { moderationAlias } from '@libs/moderation-shared-ts/alias';

const aliasNumber = (alias: string): string => alias.split(' ').at(-1) ?? '';

// regression: moderation-alias-random-number
test('the alias number comes from the subject, not from when the app loaded', () => {
  const numbers = new Set(
    Array.from({ length: 50 }, (_, i) =>
      aliasNumber(moderationAlias(`subject-${String(i)}`))
    )
  );
  expect(numbers.size).toBeGreaterThan(1);
  for (const value of numbers) expect(value).toMatch(/^[1-9]\d{2}$/);
});

// regression: moderation-alias-random-number
test('a subject keeps the same alias on every device and launch', () => {
  expect(moderationAlias('profile-1')).toBe(PINNED_PROFILE_1_ALIAS);
});

const PINNED_PROFILE_1_ALIAS = 'Fascinating Thrush 657';
