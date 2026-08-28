import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { counterDstApp } from '../apps/counter/dst-app';
import type { RoomDstAction } from '../dst/actions';
import {
  BYZANTINE_INJECT_KINDS,
  buildByzantineRaw,
  replayActionsOnWorld,
} from '../dst/commands';
import { arbWorldKnobs, arbWorldSeed, openPbtWorld } from '../dst/world-config';
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
            const opened = await openPbtWorld({
              app: counterDstApp,
              seed,
              knobs: { ...knobs, clientCount: 2 },
            });
            try {
              const before = await opened.world.serverHash();
              await replayActionsOnWorld(counterDstApp, opened.world, [
                {
                  kind: 'domain',
                  clientId: 'c0',
                  command: 'increment',
                  args: {},
                },
                { kind: 'idle', ms: 20 },
              ]);
              const raw = buildByzantineRaw(kind, opened.world.clock.now());
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
              await replayActionsOnWorld(counterDstApp, opened.world, [
                inject,
                { kind: 'idle', ms: 10 },
              ]);
              await opened.world.assertConverged();
              const after = await opened.world.serverHash();
              // Forged client frames must not change authority; real increment did.
              expect(after).not.toBe(before);
              expect(counterValue(await opened.world.serverSnapshot())).toBe(1);
              expect(opened.world.clients.get('c0')!.hash()).toBe(after);
              expect(opened.world.clients.get('c1')!.hash()).toBe(after);
            } finally {
              await opened.world.dispose();
            }
          }
        ),
        { numRuns: 9 }
      );
    },
    { timeout: 120_000 }
  );
});
