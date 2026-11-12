import { expect, test } from 'bun:test';
import {
  breathingFetch,
  createBreathe,
} from '../src/product-harness-breathing-fetch';

/** A clock the test moves, and timers that fire when the test says. */
function world() {
  let now = 0;
  const pending: (() => void)[] = [];
  return {
    advance: (ms: number) => {
      now += ms;
    },
    pending,
    clock: { now: () => now },
    timers: {
      setTimeout: (fn: () => void) => {
        pending.push(fn);
        return pending.length;
      },
      clearTimeout: () => undefined,
      setInterval: () => 0,
      clearInterval: () => undefined,
    },
  };
}

test('a breath hands the thread back only once a frame of work has passed', async () => {
  const w = world();
  const breathe = createBreathe(w.clock, w.timers);

  await breathe();
  expect(w.pending).toHaveLength(0);

  w.advance(8);
  let done = false;
  const breath = breathe().then(() => {
    done = true;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  expect(w.pending).toHaveLength(1);
  w.pending.shift()?.();
  await breath;
  expect(done).toBe(true);

  // The breath it took is the new starting point.
  await breathe();
  expect(w.pending).toHaveLength(0);
});

test('a request breathes on the way in and on the way out', async () => {
  const breaths: string[] = [];
  const send = breathingFetch(
    async () => {
      breaths.push('request');
      return new Response('ok');
    },
    async () => {
      breaths.push('breath');
    }
  );
  expect(await (await send('http://harness.local/api')).text()).toBe('ok');
  expect(breaths).toEqual(['breath', 'request', 'breath']);
});
