import { describe, expect, test } from 'bun:test';
import { fetchWithRetry } from '@pkgs/async/fetch-with-retry';
import { createSimClock } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import { assertProperty, fc } from '@pkgs/property';

/** One scripted attempt: an HTTP status, or a transport error. */
type Attempt = { kind: 'status'; status: number } | { kind: 'throw' };

const arbAttempt: fc.Arbitrary<Attempt> = fc.oneof(
  fc
    .constantFrom(200, 204, 404, 499, 500, 502, 503)
    .map((status) => ({ kind: 'status', status }) as const),
  fc.constant({ kind: 'throw' } as const)
);

const isRetryable = (a: Attempt): boolean =>
  a.kind === 'throw' || a.status >= 500;

/** Reference model: how many fetches, which backoff delays, and the final outcome. */
function model(script: readonly Attempt[], attempts: number, delayMs: number) {
  let calls = 0;
  const delays: number[] = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const a = script[attempt - 1]!;
    calls += 1;
    if (!isRetryable(a) || attempt === attempts)
      return { calls, delays, last: a };
    delays.push(delayMs * attempt);
  }
  throw new Error('unreachable: attempts >= 1');
}

/** Let the async chain run until it parks on a timer or settles (no wall time involved). */
async function drainMicrotasks(done: () => boolean, pending: () => number) {
  for (let i = 0; i < 50 && !done() && pending() === 0; i++) {
    await Promise.resolve();
  }
}

describe('fetchWithRetry model', () => {
  test('fetch count, linear backoff and final outcome agree with the model', async () => {
    await assertProperty(
      'retry model',
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 50 }),
        fc.array(arbAttempt, { minLength: 5, maxLength: 5 }),
        async (attempts, delayMs, script) => {
          const { clock, timers } = createSimClock();
          let calls = 0;
          const fetch: HttpFetch = async () => {
            const a = script[calls]!;
            calls += 1;
            if (a.kind === 'throw') throw new Error(`net:${calls}`);
            return new Response(null, { status: a.status });
          };

          let settled: { ok: Response } | { err: unknown } | null = null;
          fetchWithRetry('https://x.test/', undefined, {
            attempts,
            delayMs,
            fetch,
            timers,
          }).then(
            (ok) => {
              settled = { ok };
            },
            (err: unknown) => {
              settled = { err };
            }
          );

          const expected = model(script, attempts, delayMs);
          const observedDelays: number[] = [];
          const pending = (): number => clock.pendingOneShotCount();
          for (;;) {
            await drainMicrotasks(() => settled !== null, pending);
            if (settled !== null) break;
            const due = clock.nextDueAt();
            expect(due).not.toBeNull();
            observedDelays.push(due! - clock.now());
            clock.advance(due! - clock.now());
          }

          expect(calls).toBe(expected.calls);
          expect(observedDelays).toEqual(expected.delays);
          const result = settled as { ok: Response } | { err: unknown } | null;
          if (expected.last.kind === 'throw') {
            expect(result).toEqual({ err: new Error(`net:${expected.calls}`) });
          } else {
            expect(result !== null && 'ok' in result).toBe(true);
            expect((result as { ok: Response }).ok.status).toBe(
              expected.last.status
            );
          }
        }
      )
    );
  });

  test('spec: defaults are 3 attempts with 2000 ms linear backoff', async () => {
    const { clock, timers } = createSimClock();
    let calls = 0;
    const fetch: HttpFetch = async () => {
      calls += 1;
      return new Response(null, { status: 503 });
    };
    const p = fetchWithRetry('https://x.test/', undefined, { fetch, timers });
    const delays: number[] = [];
    for (let step = 0; step < 10 && calls < 3; step++) {
      await drainMicrotasks(
        () => false,
        () => clock.pendingOneShotCount()
      );
      const due = clock.nextDueAt();
      if (due === null) continue;
      delays.push(due - clock.now());
      clock.advance(due - clock.now());
    }
    expect((await p).status).toBe(503);
    expect(delays).toEqual([2000, 4000]);
  });
});
