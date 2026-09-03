import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import {
  arbSeed,
  domain,
} from '../../sim/scenario';
import { matchClockSystem } from '../apps/match-clock/system';
import { expectConverged } from '../expect-converged';
import {
  matchClockStatus,
  matchClockWinner,
} from '../fixtures/match-clock-module';
import { openRoom } from '../scenario/open-room';
import { playRoomActions, playRoomPin } from '../scenario/play-actions';
import { readServer } from '../scenario/read-state';

describe('room schedule-anticheat PBT', () => {
  test(
    'start move flag interleaved with hold converges',
    async () => {
      await assertProperty(
        'hold interleaved converges',
        fc.asyncProperty(arbSeed(), async (seed) => {
          await playRoomPin(matchClockSystem, {
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
    await using run = await openRoom(matchClockSystem, {
      seed: 3,
      clientCount: 2,
    });
    await run.apply(domain, {
      kind: 'domain',
      clientId: 'c0',
      command: 'start',
      args: { whiteMs: 5_000, blackMs: 5_000 },
    });
    await run.elapse(20);
    await run.apply(domain, {
      kind: 'domain',
      clientId: 'c1',
      command: 'flag-fall',
      args: { seat: 'white' },
    });
    expect(matchClockStatus(await readServer(run))).toBe('playing');
    await run.elapse(5_100);
    await expectConverged(run);
    const end = await readServer(run);
    expect(matchClockStatus(end)).toBe('flagged');
    expect(matchClockWinner(end)).toBe('black');
  });

  test('lagging held client cannot move after server flag', async () => {
    await using run = await playRoomActions(matchClockSystem, {
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
    expect(matchClockStatus(await readServer(run))).toBe('flagged');
  });
});
