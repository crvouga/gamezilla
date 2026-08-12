import { describe, expect, test } from 'bun:test';
import {
  isLikelyOpfsLockError,
  isLikelyOpfsPoolExhaustedError,
  mapExpoRunResult,
  openWithWaitRetry,
  WEB_OPEN_RETRY_DELAYS_MS,
} from './expo-sqlite-core';

describe('expo-sqlite-core', () => {
  test('mapExpoRunResult renames lastInsertRowId', () => {
    expect(mapExpoRunResult({ changes: 2, lastInsertRowId: 9 })).toEqual({
      changes: 2,
      lastInsertRowid: 9,
    });
  });

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
    let attempts = 0;
    const result = await openWithWaitRetry({
      databaseName: 'db',
      timers,
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
    expect(delays.filter((d) => d === 10 || d === 20).length).toBeGreaterThan(
      0
    );
  });

  test('isLikelyOpfsLockError detects true lock messages only', () => {
    expect(
      isLikelyOpfsLockError(new Error('NoModificationAllowedError: locked'))
    ).toBe(true);
    expect(isLikelyOpfsLockError(new Error('Error: Invalid VFS state'))).toBe(
      true
    );
    expect(isLikelyOpfsLockError(new Error('sqlite3_open_v2 failed'))).toBe(
      false
    );
    expect(isLikelyOpfsLockError(new Error('syntax error'))).toBe(false);
  });

  test('isLikelyOpfsPoolExhaustedError detects pool / open_v2 messages', () => {
    expect(
      isLikelyOpfsPoolExhaustedError(new Error('cannot create file'))
    ).toBe(true);
    expect(
      isLikelyOpfsPoolExhaustedError(new Error('Error: sqlite3_open_v2'))
    ).toBe(true);
    expect(isLikelyOpfsPoolExhaustedError(new Error('syntax error'))).toBe(
      false
    );
  });

  test('retry delay schedule is non-empty', () => {
    expect(WEB_OPEN_RETRY_DELAYS_MS.length).toBeGreaterThan(3);
  });
});
