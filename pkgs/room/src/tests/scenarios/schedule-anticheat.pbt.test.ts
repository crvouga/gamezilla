import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { matchClockDstApp } from '../apps/match-clock/dst-app';
import { replayActionsOnWorld } from '../dst/commands';
import { arbWorldSeed, openPbtWorld } from '../dst/world-config';
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
          const opened = await openPbtWorld({
            app: matchClockDstApp,
            seed,
            knobs: { clientCount: 2, mildFaults: false },
          });
          try {
            await replayActionsOnWorld(matchClockDstApp, opened.world, [
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
            ]);
            await opened.world.assertConverged();
          } finally {
            await opened.world.dispose();
          }
        }),
        { numRuns: 6 }
      );
    },
    { timeout: 180_000 }
  );

  test('early FlagFall rejected; server still flags at true at', async () => {
    const opened = await openPbtWorld({
      app: matchClockDstApp,
      seed: 3,
      knobs: { clientCount: 2, mildFaults: false },
    });
    try {
      await replayActionsOnWorld(matchClockDstApp, opened.world, [
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
      ]);
      const mid = await opened.world.serverSnapshot();
      expect(matchClockStatus(mid)).toBe('playing');
      await opened.world.runFor(5_100);
      await opened.world.assertConverged();
      const end = await opened.world.serverSnapshot();
      expect(matchClockStatus(end)).toBe('flagged');
      expect(matchClockWinner(end)).toBe('black');
    } finally {
      await opened.world.dispose();
    }
  });

  test('lagging held client cannot move after server flag', async () => {
    const opened = await openPbtWorld({
      app: matchClockDstApp,
      seed: 5,
      knobs: { clientCount: 2, mildFaults: false },
    });
    try {
      await replayActionsOnWorld(matchClockDstApp, opened.world, [
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
      ]);
      await opened.world.assertConverged();
      const end = await opened.world.serverSnapshot();
      expect(matchClockStatus(end)).toBe('flagged');
    } finally {
      await opened.world.dispose();
    }
  });
});
