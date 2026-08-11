import { describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import {
  OPFS_WIPE_RETRY_MS,
  wipeExpoSqliteOpfsWithRetries,
} from './opfs-recover';
import { sanitizeWebOpfsReturnTo } from './opfs-recover-url';

/** Resolve sleeps on the next microtask so wipe/backoff loops stay sync-fast. */
function mockTimers(): Timers {
  let nextId = 1;
  return {
    setTimeout: (fn: () => void, _ms: number) => {
      const id = nextId++;
      queueMicrotask(fn);
      return id;
    },
    clearTimeout: () => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
  };
}

describe('sanitizeWebOpfsReturnTo', () => {
  test('allows same-origin paths', () => {
    expect(sanitizeWebOpfsReturnTo('/')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/spaces?x=1#y')).toBe('/spaces?x=1#y');
  });

  test('rejects absolute and protocol-relative URLs', () => {
    expect(sanitizeWebOpfsReturnTo('https://evil.example/')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('//evil.example/')).toBe('/');
  });

  test('rejects legacy reset-opfs park paths', () => {
    expect(sanitizeWebOpfsReturnTo('/reset-opfs.html')).toBe('/');
    expect(sanitizeWebOpfsReturnTo('/foo?x=reset-opfs')).toBe('/');
  });

  test('defaults undefined / empty', () => {
    expect(sanitizeWebOpfsReturnTo(undefined)).toBe('/');
    expect(sanitizeWebOpfsReturnTo('')).toBe('/');
  });
});

describe('wipeExpoSqliteOpfsWithRetries', () => {
  test('retries until wipe succeeds', async () => {
    const timers = mockTimers();
    let attempts = 0;
    const result = await wipeExpoSqliteOpfsWithRetries(
      timers,
      '/unused-worker.js',
      async () => {
        attempts += 1;
        if (attempts < 3) {
          return { ok: false as const, error: new Error('locked') };
        }
        return { ok: true as const, skipped: false };
      }
    );
    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  test('returns failure after exhausting retries', async () => {
    const timers = mockTimers();
    const result = await wipeExpoSqliteOpfsWithRetries(
      timers,
      '/unused-worker.js',
      async () => ({ ok: false as const, error: new Error('still locked') })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(String(result.error)).toContain('still locked');
    expect(OPFS_WIPE_RETRY_MS.length).toBeGreaterThan(1);
  });
});
