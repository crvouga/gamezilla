import { describe, expect, test } from 'bun:test';
import type { Logger } from '@pkgs/logger-shared/logger';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import {
  isLikelyOpfsLockError,
  openWithWaitRetry,
  WEB_OPEN_RETRY_DELAYS_MS,
} from '@pkgs/sql-client-sqlite-web-shared/open-retry';
import { isSqlOwnerWipeWorthyError } from '@pkgs/sql-client-sqlite-web-shared/sql-owner';

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

  // regression: sqlite-web-webkit-locked-handle-not-retried
  test('a handle WebKit reports as held is waited for, not given up on', async () => {
    const timers = {
      setTimeout: (fn: () => void, ms: number) => {
        if (ms < 25_000) fn();
        return 0;
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
        // The worker of the page this one replaced still holds the file.
        if (attempts < 2) throw new Error('The object is in an invalid state.');
        return 'opened';
      },
    });
    expect(result).toBe('opened');
    expect(warnings).toEqual(['open locked; retrying']);
  });

  test('isLikelyOpfsLockError detects true lock messages only', () => {
    expect(
      isLikelyOpfsLockError(new Error('NoModificationAllowedError: locked'))
    ).toBe(true);
    expect(
      isLikelyOpfsLockError(new Error('createSyncAccessHandle failed'))
    ).toBe(true);
    // regression: sqlite-web-webkit-locked-handle-not-retried
    // WebKit's wording for a held handle, with and without its error name.
    expect(
      isLikelyOpfsLockError(new Error('The object is in an invalid state.'))
    ).toBe(true);
    expect(
      isLikelyOpfsLockError(
        new DOMException(
          'The object is in an invalid state.',
          'InvalidStateError'
        )
      )
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
