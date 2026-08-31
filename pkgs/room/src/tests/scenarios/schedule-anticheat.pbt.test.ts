import { describe, expect, test } from 'bun:test';
import { arbWorldSeed, assertDstProperty } from '@pkgs/dst/pbt';
import { fc } from '@pkgs/pbt';

import { replayRoomDst, replayRoomPin, roomDstWorld } from '../../sim/dst';
import { matchClockDst } from '../apps/match-clock/dst';
import {
  matchClockStatus,
  matchClockWinner,
} from '../fixtures/match-clock-module';

describe('room schedule-anticheat PBT', () => {
  test(
    'start move flag interleaved with hold converges',
    async () => {
      await assertDstProperty(
        'match-clock chaos converges',
        fc.asyncProperty(arbWorldSeed(), async (seed) => {
          await replayRoomPin(matchClockDst, {
            seed,
            actions: [
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'start',
                args: { whiteMs: 2_000, blackMs: 2_000 },
              },
              { kind: 'hold', clientId: 'c1' },
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'move',
                args: {},
              },
              { kind: 'idle', ms: 50 },
              { kind: 'heal' },
              { kind: 'idle', ms: 2_500 },
            ],
          });
        }),
        { numRuns: 6 }
      );
    },
    { timeout: 180_000 }
  );

  test('early FlagFall rejected; server still flags at true at', async () => {
    const world = await replayRoomDst(matchClockDst, {
      seed: 3,
      settle: false,
      actions: [
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'start',
          args: { whiteMs: 5_000, blackMs: 5_000 },
        },
        { kind: 'idle', ms: 20 },
        {
          kind: 'domain',
          clientId: 'c1',
          command: 'flag-fall',
          args: { seat: 'white' },
        },
      ],
    });
    const real = roomDstWorld(world.system);
    try {
      expect(matchClockStatus(await real.serverSnapshot())).toBe('playing');
      await real.runFor(5_100);
      await real.assertConverged();
      const end = await real.serverSnapshot();
      expect(matchClockStatus(end)).toBe('flagged');
      expect(matchClockWinner(end)).toBe('black');
    } finally {
      await world.dispose();
    }
  });

  test('lagging held client cannot move after server flag', async () => {
    const world = await replayRoomDst(matchClockDst, {
      seed: 5,
      actions: [
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'start',
          args: { whiteMs: 1_000, blackMs: 1_000 },
        },
        { kind: 'hold', clientId: 'c1' },
        { kind: 'idle', ms: 1_200 },
        {
          kind: 'domain',
          clientId: 'c1',
          command: 'move',
          args: {},
        },
        { kind: 'heal' },
      ],
    });
    try {
      const end = await roomDstWorld(world.system).serverSnapshot();
      expect(matchClockStatus(end)).toBe('flagged');
    } finally {
      await world.dispose();
    }
  });
});
