import { describe, expect, it } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import { TimeoutError } from './errors';
import { waitUntil } from './wait';

describe('waitUntil', () => {
  it('resolves when the condition becomes truthy', async () => {
    let n = 0;
    const value = await waitUntil(
      () => {
        n += 1;
        return n >= 3 ? 'ok' : null;
      },
      {
        timeoutMs: 500,
        intervalMs: 1,
        now: wallClock.now,
        timers: wallTimers,
      }
    );
    expect(value).toBe('ok');
  });

  it('throws TimeoutError when the condition never holds', async () => {
    await expect(
      waitUntil(() => false, {
        timeoutMs: 30,
        intervalMs: 5,
        description: 'never',
        now: wallClock.now,
        timers: wallTimers,
      })
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('uses pump instead of wall sleep when provided', async () => {
    let n = 0;
    let pumps = 0;
    const value = await waitUntil(
      () => {
        n += 1;
        return n >= 3 ? 'pumped' : null;
      },
      {
        timeoutMs: 500,
        now: wallClock.now,
        timers: wallTimers,
        pump: () => {
          pumps += 1;
        },
      }
    );
    expect(value).toBe('pumped');
    expect(pumps).toBe(2);
  });

  it('resolves immediately when predicate is already true (no pump)', async () => {
    let pumps = 0;
    const value = await waitUntil(() => 'ready', {
      timeoutMs: 500,
      now: wallClock.now,
      timers: wallTimers,
      pump: () => {
        pumps += 1;
      },
    });
    expect(value).toBe('ready');
    expect(pumps).toBe(0);
  });
});
