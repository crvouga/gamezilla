import { test } from 'bun:test';
import {
  impairNetwork,
  liveNetworkSystem,
  settleNetwork,
} from './live-network-system';
import {
  assertNetworkConvergence,
  networkObservation,
} from './network-observations';

test('seed 12912 never rewinds displayed progress when a delayed snapshot arrives', async () => {
  // regression: simulation-presentation-clock-rewinds-on-snapshot
  await using run = await liveNetworkSystem.run({ seed: 12912 });
  await run.apply(impairNetwork, {
    faults: {
      latencyMeanMs: 0,
      latencyJitterMs: 1,
      dropProbability: 0.1,
      duplicateProbability: 0,
      reorderProbability: 1,
    },
    hold: true,
  });
  await run.apply(settleNetwork);
  assertNetworkConvergence(await run.read(networkObservation));
});
