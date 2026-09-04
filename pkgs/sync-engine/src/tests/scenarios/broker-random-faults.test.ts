import { describe, expect, test } from 'bun:test';

import { acmeSystem, expectConverged, netSet, pool } from '../apps/acme';
import { walkThenConverge } from '../apps/acme/walk-converge';

describe('broker chaos PBT', () => {
  test(
    'brokerRestart then peer faults still converges (pin)',
    async () => {
      await using s = await acmeSystem.script({
        seed: 1_000_000,
        args: {
          liveResendOnReconnect: true,
          bufferOutboundLive: true,
          clientCount: 3,
        },
      });
      await s.apply(pool.brokerRestart);
      await s.elapse(10);
      await s.apply(netSet, 'c1', 'all', {
        dropProbability: 0.05,
        reorderWindow: 2,
        partitionProbability: 0.02,
      });
      await s.elapse(10);
      await expectConverged(s);
    },
    { timeout: 30_000 }
  );

  test(
    'pubsub fault arms interleaved with mutates converge on heal',
    async () => {
      let armed = 0;
      for (const seed of [401, 402, 403]) {
        const walk = await walkThenConverge({
          seed,
          actions: ['armPubsubFault', 'domain', 'heal'],
          steps: 10,
        });
        armed += walk.coverage.actions['armPubsubFault'] ?? 0;
      }
      expect(armed).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );

  test(
    'broker crash / restart interleaved with mutates converge on heal',
    async () => {
      let restarts = 0;
      for (const seed of [411, 412, 413]) {
        const walk = await walkThenConverge({
          seed,
          args: { liveResendOnReconnect: true },
          actions: ['brokerCrash', 'brokerRestart', 'domain', 'heal'],
          steps: 10,
        });
        restarts += walk.coverage.actions['brokerRestart'] ?? 0;
      }
      expect(restarts).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );
});
