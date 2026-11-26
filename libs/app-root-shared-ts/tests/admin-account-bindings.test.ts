import { expect, test } from 'bun:test';
import {
  ConfigurationError,
  readAdminAccountIds,
} from '@libs/app-root-shared-ts/env';

test('reads a deterministic admin account allowlist from the environment', () => {
  expect(
    readAdminAccountIds({
      ADMIN_ACCOUNT_IDS: '[" beta ","alpha","beta"]',
    })
  ).toEqual(['alpha', 'beta']);
  expect(readAdminAccountIds({})).toEqual([]);
});

test('refuses malformed admin account bindings', () => {
  for (const value of ['not-json', '{}', '["", 42]']) {
    expect(() => readAdminAccountIds({ ADMIN_ACCOUNT_IDS: value })).toThrow(
      ConfigurationError
    );
  }
});
