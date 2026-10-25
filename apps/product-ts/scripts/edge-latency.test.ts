import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { lagged } from './edge-latency';

const settled = () => new Promise<void>((resolve) => setImmediate(resolve));

test('messages sent together arrive one latency later, in order', async () => {
  // regression: edge-latency-serializes-messages
  const { clock, timers } = createHarnessClock();
  const lag = lagged({
    ms: 50,
    sleep: (ms) => new Promise((resolve) => timers.setTimeout(resolve, ms)),
  });
  const arrived: number[] = [];
  for (const message of [1, 2, 3]) lag.inOrder(() => arrived.push(message));
  await settled();
  clock.advance(49);
  await settled();
  expect(arrived).toEqual([]);
  clock.advance(1);
  for (let flush = 0; flush < 5; flush++) await settled();
  // A network delays each message; it does not send one per round trip.
  expect(arrived).toEqual([1, 2, 3]);
});
