import { describe, expect, it } from 'bun:test';
import { wallIo } from '@pkgs/io';
import { TimeoutError } from './errors';
import { waitUntil } from './wait';

const io = wallIo();

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
        now: io.clock.now,
        timers: io.timers,
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
        now: io.clock.now,
        timers: io.timers,
      })
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
