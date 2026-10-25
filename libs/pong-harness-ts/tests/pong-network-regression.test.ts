import { test } from 'bun:test';
import { verifyRecovery } from './pong-network-checks';

test('seed 1 retains the recovered court when Bob returns', async () => {
  // regression: pong-recovered-court-pause-not-observed
  await verifyRecovery(
    1,
    {
      latencyMeanMs: 0,
      latencyJitterMs: 0,
      dropProbability: 0,
      duplicateProbability: 0,
      reorderProbability: 0,
    },
    false,
    'bob'
  );
});
