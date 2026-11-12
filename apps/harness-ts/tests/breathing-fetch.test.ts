import { expect, test } from 'bun:test';
import {
  breathingFetch,
  createBreathe,
  createHandBack,
} from '../src/product-harness-breathing-fetch';

/** A clock the test moves, and a thread handed back when the test says. */
function world() {
  let now = 0;
  const pending: (() => void)[] = [];
  return {
    advance: (ms: number) => {
      now += ms;
    },
    pending,
    clock: { now: () => now },
    handBack: () =>
      new Promise<void>((resolve) => {
        pending.push(resolve);
      }),
  };
}

/** Timers as a background tab has them: none fires while the test runs. */
const heldTimers = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

test('a breath hands the thread back only once a frame of work has passed', async () => {
  const w = world();
  const breathe = createBreathe(w.clock, w.handBack);

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

// regression: harness-breath-waits-on-held-timers
test('the thread comes back while the tab holds its timers', async () => {
  const handBack = createHandBack(heldTimers);
  let back = 0;
  await Promise.all([
    handBack().then(() => back++),
    handBack().then(() => back++),
  ]);
  expect(back).toBe(2);
});
