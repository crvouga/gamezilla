import { expect, test } from 'bun:test';
import { letTimePass, partition } from '@libs/harness-ts/actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { cutConnection } from '@libs/harness-ts/platform';
import { isHostLimit } from '@pkgs/gherkin-shared-ts/registry';
import { ActionNotEnabled } from '@pkgs/harness-root-shared-ts/probe';

type Applied = { readonly name: string; readonly args: readonly unknown[] };

/** A run whose `partition` does what `outcome` says, on a host with `caps`. */
function runOn(caps: readonly string[], outcome: 'enabled' | 'refused') {
  const applied: Applied[] = [];
  const s = {
    apply: (action: { readonly name: string }, ...args: unknown[]) => {
      applied.push({ name: action.name, args });
      if (action === partition && outcome === 'refused')
        return Promise.reject(new ActionNotEnabled(action.name));
      return Promise.resolve();
    },
    read: () => Promise.resolve([...caps]),
  };
  return { w: { s } as never, applied };
}

// regression: browser-cut-connection-host-limit
test('a live browser cuts its connection through the app instead of stopping at a host limit', async () => {
  // A stack browser has no modelled network, yet `partition` is enabled on
  // it: it chooses the app's own Work offline command.
  const run = runOn([], 'enabled');
  await cutConnection(run.w, 'alice');
  expect(run.applied).toEqual([{ name: 'partition', args: ['alice'] }]);
});

test('a modelled network partitions the device and refreshes what it sees', async () => {
  const run = runOn(['partition'], 'enabled');
  await cutConnection(run.w, 'alice');
  expect(run.applied.map((call) => call.name)).toEqual([
    'partition',
    'refreshActorConnection',
    'refreshActorQueries',
  ]);
});

test('a host on which partition is not enabled is a host limit', async () => {
  const run = runOn([], 'refused');
  const thrown = await cutConnection(run.w, 'alice').then(
    () => null,
    (error: unknown) => error
  );
  expect(isHostLimit(thrown)).toBe(true);
});

// regression: wall-clock-time-travel-host-limit
test('letting days pass on the wall clock is a host limit, not a failed sleep', async () => {
  let slept = false;
  const s = {
    session: {
      caps: new Set(['partition']),
      waitForIdle: () => Promise.resolve(),
      ports: { clock: { now: () => 0 } },
      scheduler: {
        underlying: {
          sleep: () => {
            slept = true;
            return Promise.reject(
              new Error('a wall-clock scheduler cannot sleep through time')
            );
          },
        },
      },
      advanceTime: () => Promise.resolve(),
    },
  } as unknown as ProductHarness;
  const thrown = await Promise.resolve(letTimePass.act(s, 86_400_000)).then(
    () => null,
    (error: unknown) => error
  );
  expect(isHostLimit(thrown)).toBe(true);
  expect(slept).toBe(false);
});
