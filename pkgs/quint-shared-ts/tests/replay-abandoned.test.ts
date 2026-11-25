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

// regression: unreadable-browser-masks-quint-step
test('an unreadable browser at dispose preserves the billing step that failed', async () => {
  const input = new Error(
    'node stripe-mock-card input: The isolated browser did not answer'
  );
  const cleanup = new Error('alice at an unreadable page (screen: none)');
  const replay = replayTrace({
    ctx: { ...ctx, specUri: 'specs/billing/grace-and-refunds.qnt' },
    trace: { vars: [], states: [{ action: 'subscribe', picks: {}, vars: {} }] },
    world: {
      create: async () => ({}),
      dispose: async () => {
        throw cleanup;
      },
    },
    binding: {
      model: 'grace-and-refunds',
      actions: {
        subscribe: async () => {
          throw input;
        },
      },
      observe: async () => ({}),
    },
  });
  const error = await replay.catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(AggregateError);
  const combined = error as AggregateError;
  expect(combined.message).toContain(input.message);
  expect(combined.message).toContain(cleanup.message);
  expect(combined.errors[0].cause).toBe(input);
  expect(combined.errors[1]).toBe(cleanup);
});
