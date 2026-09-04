import { describe, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { SIM_PBT_CRASH_EVENTS } from '../../sim/boundary-faults';
import {
  arbSeed,
  armCrashAt,
  clearFaults,
  domain,
  restart,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { openRoom } from '../scenario/open-room';

const increment = (clientId: string) =>
  ({
    kind: 'domain',
    clientId,
    command: 'increment',
    args: {},
  }) as const;

describe('room armCrashAt slice PBT', () => {
  test(
    'each armCrashAt event then settle converges',
    async () => {
      await assertProperty(
        'armCrashAt slice converges',
        fc.asyncProperty(
          arbSeed(),
          fc.constantFrom(...SIM_PBT_CRASH_EVENTS),
          async (seed, event) => {
            await using s = await openRoom(counterSystem, {
              seed,
              clientCount: 2,
              mildFaults: false,
            });
            await s.apply(armCrashAt, { clientId: 'c1', event });
            await s.apply(domain, increment('c0'));
            await s.elapse(30);
            await s.apply(clearFaults);
            await s.apply(restart, 'c1');
            await s.apply(domain, increment('c1'));
            await expectConverged(s);
          }
        ),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );
});
