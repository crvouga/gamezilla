import { test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  impairNetwork,
  liveNetworkSystem,
  settleNetwork,
} from './live-network-system';
import {
  assertNetworkConvergence,
  networkObservation,
} from './network-observations';

test('live session replicas converge after a bounded seeded window of delayed, lost, reordered, duplicate and held frames', async () => {
  await assertProperty(
    'live-session-network-convergence',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 1_000_000 }),
      fc.record({
        latencyMeanMs: fc.integer({ min: 0, max: 80 }),
        latencyJitterMs: fc.integer({ min: 0, max: 40 }),
        dropProbability: fc.constantFrom(0, 0.1, 0.3),
        duplicateProbability: fc.constantFrom(0, 0.5, 1),
        reorderProbability: fc.constantFrom(0, 1),
      }),
      fc.boolean(),
      async (seed, faults, hold) => {
        await using run = await liveNetworkSystem.run({ seed });
        await run.apply(impairNetwork, { faults, hold });
        await run.apply(settleNetwork);
        assertNetworkConvergence(await run.read(networkObservation));
      }
    )
  );
});
