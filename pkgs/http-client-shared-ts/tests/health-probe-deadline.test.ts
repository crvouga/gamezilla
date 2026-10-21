import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createHealthOriginAvailability } from '@pkgs/http-client-shared-ts/origin-availability';

// regression: stalled-response-keeps-choice-working
test('a stalled health probe stops waiting and can recover on a later probe', async () => {
  const { clock, timers } = createHarnessClock();
  let working = false;
  const availability = createHealthOriginAvailability({
    healthUrl: 'http://localhost:5428/api/health',
    clock,
    timers,
    fetch: () =>
      working
        ? Promise.resolve(Response.json({ status: 'ok' }))
        : new Promise(() => {}),
  });
  availability.start();
  expect(availability.getSnapshot().phase).toBe('probing');
  clock.advance(10_000);
  for (let turn = 0; turn < 16; turn++) await Promise.resolve();
  expect(availability.getSnapshot().phase).toBe('unavailable');
  working = true;
  clock.advance(1_000);
  for (let turn = 0; turn < 16; turn++) await Promise.resolve();
  expect(availability.getSnapshot().phase).toBe('available');
  availability.stop();
  expect(clock.pendingOneShotCount()).toBe(0);
});
