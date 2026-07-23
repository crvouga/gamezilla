import { describe, expect, test } from 'bun:test';

import {
  isBootErrorForTarget,
  isBootReadyForTarget,
  type SyncBootReport,
} from './account-switch-boot-gate';
import { remainingMs } from './account-switch-timing';
import { waitForTargetBootReady } from './account-switch-wait';

describe('account-switch-boot-gate', () => {
  test('ready matches target account id', () => {
    expect(
      isBootReadyForTarget({ phase: 'ready', accountId: 'a' }, 'a')
    ).toBe(true);
    expect(
      isBootReadyForTarget({ phase: 'ready', accountId: 'a' }, 'b')
    ).toBe(false);
    expect(
      isBootReadyForTarget({ phase: 'loading', accountId: 'a' }, 'a')
    ).toBe(false);
  });

  test('error matches target account id', () => {
    expect(
      isBootErrorForTarget({ phase: 'error', accountId: 'a' }, 'a')
    ).toBe(true);
    expect(
      isBootErrorForTarget({ phase: 'error', accountId: 'a' }, 'b')
    ).toBe(false);
  });
});

describe('remainingMs', () => {
  test('returns leftover until min', () => {
    const startedAt = Date.now() - 200;
    expect(remainingMs(startedAt, 700)).toBeGreaterThanOrEqual(400);
    expect(remainingMs(startedAt, 700)).toBeLessThanOrEqual(500);
  });

  test('returns 0 when past min', () => {
    expect(remainingMs(Date.now() - 1000, 700)).toBe(0);
  });
});

describe('waitForTargetBootReady', () => {
  test('resolves when target becomes ready', async () => {
    let report: SyncBootReport = { phase: 'loading', accountId: 'a' };
    const listeners = new Set<() => void>();
    const pending = waitForTargetBootReady(
      'a',
      () => report,
      (onChange) => {
        listeners.add(onChange);
        return () => {
          listeners.delete(onChange);
        };
      }
    );
    report = { phase: 'ready', accountId: 'a' };
    for (const listener of listeners) listener();
    await pending;
  });

  test('null target ignores stale ready until loading', async () => {
    let report: SyncBootReport = { phase: 'ready', accountId: null };
    const listeners = new Set<() => void>();
    let resolved = false;
    const pending = waitForTargetBootReady(
      null,
      () => report,
      (onChange) => {
        listeners.add(onChange);
        return () => {
          listeners.delete(onChange);
        };
      }
    ).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    report = { phase: 'loading', accountId: null };
    for (const listener of listeners) listener();
    report = { phase: 'ready', accountId: null };
    for (const listener of listeners) listener();
    await pending;
    expect(resolved).toBe(true);
  });
});
