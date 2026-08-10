import { describe, expect, mock, test } from 'bun:test';

import {
  ExpoSqliteWebSessionLockError,
  isExpoSqliteWebSessionLockError,
  resetExpoSqliteWebSessionLockForTests,
  tryAcquireExpoSqliteWebSessionLockWith,
} from './expo-web-session-lock-core';

describe('tryAcquireExpoSqliteWebSessionLockWith', () => {
  test('resolves immediately on native', async () => {
    resetExpoSqliteWebSessionLockForTests();
    await expect(
      tryAcquireExpoSqliteWebSessionLockWith({
        platformOs: 'ios',
        locks: undefined,
        onPageHide: () => {},
      })
    ).resolves.toBeUndefined();
  });

  test('rejects when another tab holds the lock through the wait budget', async () => {
    resetExpoSqliteWebSessionLockForTests();
    const locks = {
      request: mock(
        (
          _name: string,
          options: { ifAvailable?: boolean },
          callback: (lock: null) => unknown
        ) => {
          if (options.ifAvailable === true) {
            callback(null);
            return Promise.resolve();
          }
          return Promise.reject(new DOMException('aborted', 'AbortError'));
        }
      ),
    } as unknown as Pick<LockManager, 'request'>;

    await expect(
      tryAcquireExpoSqliteWebSessionLockWith({
        platformOs: 'web',
        locks,
        onPageHide: () => {},
        lockWaitMs: 10,
      })
    ).rejects.toBeInstanceOf(ExpoSqliteWebSessionLockError);
    expect(
      isExpoSqliteWebSessionLockError(new ExpoSqliteWebSessionLockError())
    ).toBe(true);
  });

  test('resolves when the lock is available', async () => {
    resetExpoSqliteWebSessionLockForTests();
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

  test('second acquire in the same realm reuses the held lock', async () => {
    resetExpoSqliteWebSessionLockForTests();
    let requestCount = 0;
    const locks = {
      request: mock(
        (
          _name: string,
          _options: unknown,
          callback: (lock: object) => unknown
        ) => {
          requestCount += 1;
          return callback({});
        }
      ),
    } as unknown as Pick<LockManager, 'request'>;

    await tryAcquireExpoSqliteWebSessionLockWith({
      platformOs: 'web',
      locks,
      onPageHide: () => {},
    });
    await tryAcquireExpoSqliteWebSessionLockWith({
      platformOs: 'web',
      locks,
      onPageHide: () => {},
    });
    expect(requestCount).toBe(1);
  });

  test('waits when ifAvailable misses then acquires', async () => {
    resetExpoSqliteWebSessionLockForTests();
    let calls = 0;
    const locks = {
      request: mock(
        (
          _name: string,
          options: { ifAvailable?: boolean },
          callback: (lock: object | null) => unknown
        ) => {
          calls += 1;
          if (options.ifAvailable === true) {
            callback(null);
            return Promise.resolve();
          }
          return callback({});
        }
      ),
    } as unknown as Pick<LockManager, 'request'>;

    await expect(
      tryAcquireExpoSqliteWebSessionLockWith({
        platformOs: 'web',
        locks,
        onPageHide: () => {},
        lockWaitMs: 50,
      })
    ).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});
