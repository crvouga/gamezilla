import { describe, expect, test } from 'bun:test';
import { inCompletionOrder } from '@crvouga/atlas-reports/completion-order';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

/** Settles after `hops` microtask turns: a deterministic stand-in for latency. */
async function after<T>(hops: number, value: T): Promise<T> {
  for (let i = 0; i < hops; i += 1) await Promise.resolve();
  return value;
}

describe('inCompletionOrder', () => {
  test('yields every result exactly once, never running more than the limit', async () => {
    await assertProperty(
      'complete and bounded',
      fc.asyncProperty(
        fc.array(fc.nat({ max: 12 }), { maxLength: 20 }),
        fc.integer({ min: 1, max: 6 }),
        async (latencies, limit) => {
          let inFlight = 0;
          let most = 0;
          const tasks = latencies.map((hops, i) => async () => {
            inFlight += 1;
            most = Math.max(most, inFlight);
            const value = await after(hops, i);
            inFlight -= 1;
            return value;
          });
          const seen: number[] = [];
          for await (const value of inCompletionOrder(tasks, limit)) {
            seen.push(value);
          }
          expect([...seen].sort((a, b) => a - b)).toEqual(
            latencies.map((_, i) => i)
          );
          expect(most).toBeLessThanOrEqual(limit);
        }
      )
    );
  });

  test('a fast task is never held back by a slower one started before it', async () => {
    const tasks = [() => after(20, 'slow'), () => after(0, 'fast')];
    const seen: string[] = [];
    for await (const value of inCompletionOrder(tasks, 2)) seen.push(value);
    expect(seen).toEqual(['fast', 'slow']);
  });

  test('a failed task fails the stream once the started ones settle', async () => {
    const tasks = [
      () => after(3, 'ok'),
      () => after(1, null).then(() => Promise.reject(new Error('boom'))),
    ];
    const seen: unknown[] = [];
    let failure: unknown = null;
    try {
      for await (const value of inCompletionOrder(tasks, 2)) seen.push(value);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('boom');
  });
});
