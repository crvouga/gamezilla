import { describe, expect, it } from 'bun:test';
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
      { timeoutMs: 500, intervalMs: 1 }
    );
    expect(value).toBe('ok');
  });

  it('throws TimeoutError when the condition never holds', async () => {
    await expect(
      waitUntil(() => false, {
        timeoutMs: 30,
        intervalMs: 5,
        description: 'never',
      })
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
