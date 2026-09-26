import { describe, expect, test } from 'bun:test';
import { createNoopLogger, type Logger } from '@pkgs/logger';
import {
  isLikelyOpfsLockError,
  openWithWaitRetry,
  WEB_OPEN_RETRY_DELAYS_MS,
} from './open-retry';
import { isSqlOwnerWipeWorthyError } from './sql-owner';

describe('open-retry', () => {
  test('openWithWaitRetry backs off on lock errors then succeeds', async () => {
    const delays: number[] = [];
    const timers = {
      setTimeout: (fn: () => void, ms: number) => {
        // Do not fire the open-timeout watchdog in this unit test.
        if (ms >= 25_000) return 0;
        delays.push(ms);
        fn();
        return delays.length;
      },
      clearTimeout: () => undefined,
      setInterval: () => 0,
      clearInterval: () => undefined,
    };
    const warnings: string[] = [];
    const logger: Logger = {
      ...createNoopLogger(),
      warn: (msg) => warnings.push(msg),
    };
    let attempts = 0;
    const result = await openWithWaitRetry({
      databaseName: 'db',
      timers,
      logger,
      delaysMs: [10, 20],
      openOnce: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('NoModificationAllowedError: locked');
        }
        return 'ok';
      },
    });
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
    expect(warnings).toEqual([
      'open locked; retrying',
      'open locked; retrying',
    ]);
    expect(delays.filter((d) => d === 10 || d === 20).length).toBeGreaterThan(
      0
    );
  });

  test('isLikelyOpfsLockError detects true lock messages only', () => {
    expect(
      isLikelyOpfsLockError(new Error('NoModificationAllowedError: locked'))
    ).toBe(true);
    expect(
      isLikelyOpfsLockError(new Error('createSyncAccessHandle failed'))
    ).toBe(true);
    expect(isLikelyOpfsLockError(new Error('sqlite3_open_v2 failed'))).toBe(
      false
    );
    expect(isLikelyOpfsLockError(new Error('syntax error'))).toBe(false);
  });

  test('wipe-worthy errors detect pool / corrupt messages', () => {
    expect(isSqlOwnerWipeWorthyError(new Error('cannot create file'))).toBe(
      true
    );
    expect(isSqlOwnerWipeWorthyError(new Error('file is not a database'))).toBe(
      true
    );
    expect(isSqlOwnerWipeWorthyError(new Error('syntax error'))).toBe(false);
  });

  test('retry delay schedule is non-empty', () => {
    expect(WEB_OPEN_RETRY_DELAYS_MS.length).toBeGreaterThan(3);
  });
});
