import { describe, expect, test } from 'bun:test';
import { arbWorldSeed, assertDstProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';

import {
  arbRoomKnobs,
  BYZANTINE_INJECT_KINDS,
  type ByzantineInjectKind,
  buildByzantineRaw,
  playRoomActions,
  type RoomDstAction,
  replayRoomDst,
  roomDstWorld,
} from '../../sim/dst';
import type { World } from '../../sim/world-api';
import { counterDst } from '../apps/counter/dst';
import { counterValue } from '../fixtures/counter-module';

function injectAction(kind: ByzantineInjectKind, now: number): RoomDstAction {
  const raw = buildByzantineRaw(kind, now);
  if (raw.direction === 'toServer') {
    return {
      kind: 'injectToServer',
      clientId: 'c1',
      raw: raw.raw,
      direct: true,
    };
  }
  return { kind: 'injectFromServer', clientId: 'c1', raw: raw.raw };
}

async function expectServerTruthRestored(
  real: World,
  before: string
): Promise<void> {
  const after = await real.serverHash();
  // Forged client frames must not change authority; the real increment did.
  expect(after).not.toBe(before);
  expect(counterValue(await real.serverSnapshot())).toBe(1);
  expect(real.clients.get('c0')!.hash()).toBe(after);
  expect(real.clients.get('c1')!.hash()).toBe(after);
}

describe('room byzantine-wire PBT', () => {
  test(
    'each inject catalog arm then settle restores server truth',
    async () => {
      await assertDstProperty(
        'byzantine inject converges to server',
        fc.asyncProperty(
          arbWorldSeed(),
          arbRoomKnobs(),
          fc.constantFrom(...BYZANTINE_INJECT_KINDS),
          async (seed, knobs, kind) => {
            const world = await replayRoomDst(counterDst, {
              seed,
              knobs: { ...knobs, clientCount: 2 },
              settle: false,
              actions: [],
            });
            const real = roomDstWorld(world.system);
            try {
              const before = await real.serverHash();
              await playRoomActions(world, [
                {
                  kind: 'domain',
                  clientId: 'c0',
                  command: 'increment',
                  args: {},
                },
                { kind: 'idle', ms: 20 },
              ]);
              await playRoomActions(world, [
                injectAction(kind, real.clock.now()),
                { kind: 'idle', ms: 10 },
              ]);
              await real.assertConverged();
              await expectServerTruthRestored(real, before);
            } finally {
              await world.dispose();
            }
          }
        ),
        { numRuns: 9 }
      );
    },
    { timeout: 120_000 }
  );
});
