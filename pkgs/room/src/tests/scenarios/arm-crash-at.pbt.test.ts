import { describe, test } from 'bun:test';
import { arbWorldSeed, assertDstProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';

import { WORLD_PBT_CRASH_EVENTS } from '../../sim/boundary-faults';
import { playRoomActions, replayRoomDst, roomDstWorld } from '../../sim/dst';
import { counterDst } from '../apps/counter/dst';

/**
 * Scripted armCrashAt slice — intentionally out of the random library pool
 * (see library-arbs.ts). Covers each crash event under a short domain
 * sequence then settle.
 */
describe('room armCrashAt slice PBT', () => {
  test(
    'each armCrashAt event then settle converges',
    async () => {
      await assertDstProperty(
        'armCrashAt slice converges',
        fc.asyncProperty(
          arbWorldSeed(),
          fc.constantFrom(...WORLD_PBT_CRASH_EVENTS),
          async (seed, event) => {
            const world = await replayRoomDst(counterDst, {
              seed,
              knobs: { clientCount: 2, mildFaults: false },
              settle: false,
              actions: [
                {
                  kind: 'armCrashAt',
                  clientId: 'c1',
                  event,
                },
                {
                  kind: 'domain',
                  clientId: 'c0',
                  command: 'increment',
                  args: {},
                },
                { kind: 'idle', ms: 30 },
              ],
            });
            const real = roomDstWorld(world.system);
            try {
              // Restart clears the node but a lingering afterNextWelcome arm
              // would crash again on the reconnect welcome — clear arms first.
              real.clearBoundaryFaults();
              await playRoomActions(world, [
                { kind: 'restart', clientId: 'c1' },
                {
                  kind: 'domain',
                  clientId: 'c1',
                  command: 'increment',
                  args: {},
                },
              ]);
              await real.assertConverged();
            } finally {
              await world.dispose();
            }
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
