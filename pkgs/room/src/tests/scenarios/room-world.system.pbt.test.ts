import { describe, test } from 'bun:test';
import { assertSample } from '@pkgs/determinism/pbt';

import { replayRoom, replayRoomPin, roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';

describe('room world PBT', () => {
  test(
    'fc.commands sequences replay on World and converge',
    async () => {
      await assertSample(counterSystem, { maxCommands: 14 });
    },
    { timeout: 180_000 }
  );

  test('hold then increment then heal converges (pin)', async () => {
    await replayRoomPin(counterSystem, {
      seed: 42,
      actions: [
        { kind: 'hold', clientId: 'c1' },
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'increment',
          args: {},
        },
        { kind: 'idle', ms: 20 },
        { kind: 'heal' },
      ],
    });
  });

  test('crash then restart with pending offline queue converges (pin)', async () => {
    await replayRoomPin(counterSystem, {
      seed: 99,
      actions: [
        { kind: 'disconnect', clientId: 'c0' },
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'increment',
          args: {},
        },
        { kind: 'crash', clientId: 'c0' },
        {
          kind: 'domain',
          clientId: 'c1',
          command: 'increment',
          args: {},
        },
        { kind: 'restart', clientId: 'c0' },
      ],
    });
  });

  test('armCrashAt afterNextCommitted then settle (pin FC_SEED=665742204)', async () => {
    await replayRoomPin(counterSystem, {
      seed: 706975,
      actions: [
        {
          kind: 'armCrashAt',
          clientId: 'c1',
          event: 'afterNextCommitted',
        },
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'decrement',
          args: {},
        },
        // c1 may already be crashed from the arm — restart before more work.
        { kind: 'restart', clientId: 'c1' },
        {
          kind: 'domain',
          clientId: 'c1',
          command: 'decrement',
          args: {},
        },
        {
          kind: 'asymmetricLink',
          clientId: 'c0',
          link: { toClient: 'hold', toServer: 'ok' },
        },
      ],
    });
  });

  test('ghost durable queue: dispatch then settle leaves queues empty (pin)', async () => {
    const world = await replayRoom(counterSystem, {
      seed: 4242,
      actions: [
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'increment',
          args: {},
        },
        {
          kind: 'domain',
          clientId: 'c1',
          command: 'increment',
          args: {},
        },
        { kind: 'idle', ms: 40 },
      ],
    });
    try {
      const inv = await roomWorld(world.state).checkInvariants();
      if (inv !== null) {
        throw new Error(`${inv.invariant}: ${inv.detail}`);
      }
    } finally {
      await world.dispose();
    }
  });
});
