import { describe, expect, test } from 'bun:test';

import { matchesRecoverableExpoSqliteWebErrorMessage } from './expo-web-recovery-core';

describe('matchesRecoverableExpoSqliteWebErrorMessage', () => {
  test('matches OPFS journal failures', () => {
    const error = new Error('Error: Error finalizing statement', {
      cause: new Error('cannot create file'),
    });
    expect(matchesRecoverableExpoSqliteWebErrorMessage(error)).toBe(true);
  });

  test('matches database corruption messages', () => {
    expect(
      matchesRecoverableExpoSqliteWebErrorMessage(
        new Error('database disk image is malformed')
      )
    ).toBe(true);
  });
});
