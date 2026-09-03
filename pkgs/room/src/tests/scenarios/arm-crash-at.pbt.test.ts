import { describe, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import { WORLD_PBT_CRASH_EVENTS } from '../../sim/boundary-faults';
import { arbSeed, playRoomActions, startRoom } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';

describe('room armCrashAt slice PBT', () => {
  test(
    'each armCrashAt event then settle converges',
    async () => {
      await assertProperty(
        'armCrashAt slice converges',
        fc.asyncProperty(
          arbSeed(),
          fc.constantFrom(...WORLD_PBT_CRASH_EVENTS),
          async (seed, event) => {
            await using run = await startRoom(counterSystem, {
              seed,
              clientCount: 2,
              mildFaults: false,
            });
            await playRoomActions(run, [
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
            const world = run._internal.surface.world;
            world.clearBoundaryFaults();
            await playRoomActions(run, [
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
