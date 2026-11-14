import { expect, test } from 'bun:test';
import type { ItfTrace } from '@pkgs/quint-shared-ts/itf';
import type { QuintWorld } from '@pkgs/quint-shared-ts/registry';
import { replayTrace } from '@pkgs/quint-shared-ts/replay';

const ctx = {
  packageName: '@pkgs/quint',
  specUri: 'clock.qnt',
  model: 'clock',
  trace: 1,
  seed: '0x2a',
  testId: 'clock.abandoned',
  title: 'Clock abandoned',
};

const trace: ItfTrace = {
  vars: ['day'],
  states: [
    { action: 'init', picks: {}, vars: { day: 0n } },
    { action: 'daysPass', picks: {}, vars: { day: 1n } },
    { action: 'look', picks: {}, vars: { day: 1n } },
  ],
};

// regression: timed-out-trace-runs-on
test('a trace whose test timed out stops at its next step and frees its world quietly', async () => {
  const steps: string[] = [];
  const timedOut = new AbortController();
  let disposed = false;
  const world: QuintWorld<unknown> = {
    create: async () => ({}),
    dispose: async () => {
      disposed = true;
      // What a property checked at dispose reports about a closed screen.
      throw new Error('global action menu not visible');
    },
  };
  const replay = replayTrace({
    ctx,
    trace,
    world,
    abandoned: timedOut.signal,
    binding: {
      model: 'clock',
      actions: {
        init: async () => {
          steps.push('init');
        },
        daysPass: async () => {
          steps.push('daysPass');
          // Bun's timeout passes while the step is still running.
          timedOut.abort();
          throw new Error('the browser closed');
        },
        look: async () => {
          steps.push('look');
        },
      },
      observe: async () => ({ day: steps.includes('daysPass') ? 1n : 0n }),
    },
  });
  expect(await replay).toBeNull();
  expect(steps).toEqual(['init', 'daysPass']);
  expect(disposed).toBe(true);
});

test('a trace still in time reports its failures as before', async () => {
  const world: QuintWorld<unknown> = {
    create: async () => ({}),
    dispose: async () => {},
  };
  const replay = replayTrace({
    ctx,
    trace,
    world,
    abandoned: new AbortController().signal,
    binding: {
      model: 'clock',
      actions: {
        init: async () => {},
        daysPass: async () => {
          throw new Error('the product broke');
        },
        look: async () => {},
      },
      observe: async () => ({ day: 0n }),
    },
  });
  await expect(replay).rejects.toThrow('the product broke');
});
