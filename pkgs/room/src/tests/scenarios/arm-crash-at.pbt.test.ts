import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { WORLD_PBT_CRASH_EVENTS } from '../../sim/boundary-faults';
import { openWorld } from '../../sim/world';
import { counterDstApp } from '../apps/counter/dst-app';
import { arbWorldKnobs, arbWorldSeed } from '../dst/world-config';

/**
 * Scripted armCrashAt slice — intentionally out of the random fc.commands
 * pool (see command-arbs.ts). Covers each crash event under a short domain
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
          arbWorldKnobs(),
          fc.constantFrom(...WORLD_PBT_CRASH_EVENTS),
          async (seed, knobs, event) => {
            await using world = await openWorld({
              app: counterDstApp,
              seed,
              knobs: { ...knobs, clientCount: 2, mildFaults: false },
            });
            await world.playActions([
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
            ]);
            // Restart clears the node but a lingering afterNextWelcome arm
            // would crash again on the reconnect welcome — clear arms first.
            world.clearBoundaryFaults();
            await world.playActions([
              { kind: 'restart', clientId: 'c1' },
              {
                kind: 'domain',
                clientId: 'c1',
                command: 'increment',
                args: {},
              },
            ]);
            await world.assertConverged();
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
