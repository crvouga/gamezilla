import { describe, expect, test } from 'bun:test';

import { resolveSqliteDbName } from './resolve-sqlite-db-name';

describe('resolveSqliteDbName', () => {
  const deviceId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';

  test('anonymous uses short device id', () => {
    expect(resolveSqliteDbName({ accountId: null, deviceId })).toBe(
      'anon_111111111111'
    );
  });

  test('signed-in uses short account id', () => {
    expect(resolveSqliteDbName({ accountId, deviceId })).toBe(
      'acct_222222222222'
    );
  });

  test('web tab suffix is shortened and appended', () => {
    expect(
      resolveSqliteDbName({
        accountId,
        deviceId,
        webTabSuffix: 'abcdef0123456789abcdef0123456789',
      })
    ).toBe('acct_222222222222_abcdef012345');
  });
});
