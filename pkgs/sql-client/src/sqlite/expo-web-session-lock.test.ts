import { describe, expect, mock, test } from 'bun:test';

import {
  ExpoSqliteWebSessionLockError,
  isExpoSqliteWebSessionLockError,
  tryAcquireExpoSqliteWebSessionLockWith,
} from './expo-web-session-lock-core';

describe('tryAcquireExpoSqliteWebSessionLockWith', () => {
  test('resolves immediately on native', async () => {
    await expect(
      tryAcquireExpoSqliteWebSessionLockWith({
        platformOs: 'ios',
        locks: undefined,
        onPageHide: () => {},
      })
    ).resolves.toBeUndefined();
  });

  test('rejects when another tab holds the lock', async () => {
    const locks = {
      request: mock(
        (_name: string, _options: unknown, callback: (lock: null) => void) => {
          callback(null);
          return Promise.resolve();
        }
      ),
    } as unknown as Pick<LockManager, 'request'>;

    await expect(
      tryAcquireExpoSqliteWebSessionLockWith({
        platformOs: 'web',
        locks,
        onPageHide: () => {},
      })
    ).rejects.toBeInstanceOf(ExpoSqliteWebSessionLockError);
    expect(
      isExpoSqliteWebSessionLockError(new ExpoSqliteWebSessionLockError())
    ).toBe(true);
  });

  test('resolves when the lock is available', async () => {
    const locks = {
      request: mock(
        (
          _name: string,
          _options: unknown,
          callback: (lock: object) => unknown
        ) => {
          return callback({});
        }
      ),
    } as unknown as Pick<LockManager, 'request'>;

    await expect(
      tryAcquireExpoSqliteWebSessionLockWith({
        platformOs: 'web',
        locks,
        onPageHide: (release) => {
          release();
        },
      })
    ).resolves.toBeUndefined();
  });
});
