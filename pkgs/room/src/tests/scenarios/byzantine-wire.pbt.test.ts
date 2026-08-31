import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { openWorld } from '../../sim/world';
import { counterDstApp } from '../apps/counter/dst-app';
import type { RoomDstAction } from '../dst/actions';
import { BYZANTINE_INJECT_KINDS, buildByzantineRaw } from '../dst/commands';
import { arbWorldKnobs, arbWorldSeed } from '../dst/world-config';
import { counterValue } from '../fixtures/counter-module';

describe('room byzantine-wire PBT', () => {
  test(
    'each inject catalog arm then settle restores server truth',
    async () => {
      await assertDstProperty(
        'byzantine inject converges to server',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          fc.constantFrom(...BYZANTINE_INJECT_KINDS),
          async (seed, knobs, kind) => {
            await using world = await openWorld({
              app: counterDstApp,
              seed,
              knobs: { ...knobs, clientCount: 2 },
            });
            const before = await world.serverHash();
            await world.playActions([
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'increment',
                args: {},
              },
              { kind: 'idle', ms: 20 },
            ]);
            const raw = buildByzantineRaw(kind, world.clock.now());
            const inject: RoomDstAction =
              raw.direction === 'toServer'
                ? {
                    kind: 'injectToServer',
                    clientId: 'c1',
                    raw: raw.raw,
                    direct: true,
                  }
                : {
                    kind: 'injectFromServer',
                    clientId: 'c1',
                    raw: raw.raw,
                  };
            await world.playActions([inject, { kind: 'idle', ms: 10 }]);
            await world.assertConverged();
            const after = await world.serverHash();
            // Forged client frames must not change authority; real increment did.
            expect(after).not.toBe(before);
            expect(counterValue(await world.serverSnapshot())).toBe(1);
            expect(world.clients.get('c0')!.hash()).toBe(after);
            expect(world.clients.get('c1')!.hash()).toBe(after);
          }
        ),
        { numRuns: 9 }
      );
    },
    { timeout: 120_000 }
  );
});
