import { expect, test } from 'bun:test';
import type { ItfTrace } from '@pkgs/quint-shared-ts/itf';
import type { QuintWorld } from '@pkgs/quint-shared-ts/registry';
import { replayTrace } from '@pkgs/quint-shared-ts/replay';

const LIMIT = Symbol('limit');

const ctx = {
  packageName: '@pkgs/quint',
  specUri: 'clock.qnt',
  model: 'clock',
  trace: 1,
  seed: '0x2a',
  testId: 'clock.host-limit',
  title: 'Clock host limit',
};

const trace: ItfTrace = {
  vars: ['day'],
  states: [
    { action: 'init', picks: {}, vars: { day: 0n } },
    { action: 'daysPass', picks: {}, vars: { day: 1n } },
    { action: 'look', picks: {}, vars: { day: 1n } },
  ],
};

function replayWith(thrown: unknown, steps: string[]) {
  let disposed = false;
  const world: QuintWorld<unknown> = {
    create: async () => ({}),
    dispose: async () => {
      disposed = true;
    },
    isHostLimit: (cause) =>
      typeof cause === 'object' && cause !== null && LIMIT in cause,
  };
  const replay = replayTrace({
    ctx,
    trace,
    world,
    binding: {
      model: 'clock',
      actions: {
        init: async () => {
          steps.push('init');
        },
        daysPass: async () => {
          steps.push('daysPass');
          throw thrown;
        },
        look: async () => {
          steps.push('look');
        },
      },
      observe: async () => ({ day: steps.includes('daysPass') ? 1n : 0n }),
    },
  });
  return { replay, disposed: () => disposed };
}

// regression: wall-clock-time-travel-host-limit
test('a step the host cannot perform ends the trace there without failing it', async () => {
  const steps: string[] = [];
  const run = replayWith(
    Object.assign(new Error('host limit: wall clock'), { [LIMIT]: true }),
    steps
  );
  expect(await run.replay).toBeNull();
  expect(steps).toEqual(['init', 'daysPass']);
  expect(run.disposed()).toBe(true);
});

test('any other error a step throws still fails the trace', async () => {
  const steps: string[] = [];
  const run = replayWith(new Error('the product broke'), steps);
  await expect(run.replay).rejects.toThrow('the product broke');
  expect(steps).toEqual(['init', 'daysPass']);
});
