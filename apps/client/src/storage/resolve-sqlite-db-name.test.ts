import { describe, expect, test } from 'bun:test';

import { resolveSqliteDbName } from './resolve-sqlite-db-name';

describe('resolveSqliteDbName', () => {
  const userId = '22222222-2222-2222-2222-222222222222';

  test('uses short user id', () => {
    expect(resolveSqliteDbName({ userId })).toBe('user_222222222222');
  });

  test('web tab suffix is shortened and appended', () => {
    expect(
      resolveSqliteDbName({
        userId,
        webTabSuffix: 'abcdef0123456789abcdef0123456789',
      })
    ).toBe('user_222222222222_abcdef012345');
  });
});
