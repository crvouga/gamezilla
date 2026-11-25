import { expect, test } from 'bun:test';
import { pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { createVirtualClock } from '@pkgs/harness-root-shared-ts/clock';

// regression: browser-probe-outlives-actor-deadline
test('browser reads consume the 15 second finding-an-opponent deadline', async () => {
  const clock = createVirtualClock();
  const harness = {
    session: {
      scheduler: { virtual: false, clock, starvedAdvances: () => 0 },
      advanceTime: (ms: number) => Promise.resolve(clock.advance(ms)),
      waitForIdle: () => Promise.resolve(),
    },
  } as unknown as ProductHarness;
  let probes = 0;
  const probe = () => {
    probes++;
    clock.advance(7_500);
    return Promise.resolve(null);
  };
  await expect(
    pollUntil(harness, probe, {
      maxMs: 15_000,
      stepMs: 1,
      description: 'Alice opens finding an opponent',
    })
  ).rejects.toThrow('15000ms waiting for Alice opens finding an opponent');
  expect(probes).toBe(2);
});
