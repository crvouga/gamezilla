import { describe, expect, test } from 'bun:test';
import { explore } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';

import {
  arbRoomKnobs,
  invariantViolations,
  ROOM_PROPERTIES,
  roomActions,
  roomVirtualHost,
} from '../../sim/scenario';
import { counterApp } from '../apps/counter/app';
import { counterSystem } from '../apps/counter/system';
import {
  playRoomActions,
  playRoomPin,
} from '../scenario/play-actions';

describe('room system PBT', () => {
  test(
    'check explores room actions under ROOM_PROPERTIES',
    async () => {
      const report = await explore(counterSystem, {
        properties: ROOM_PROPERTIES,
        actions: roomActions(counterApp),
        knobs: gen(arbRoomKnobs()),
        host: roomVirtualHost(),
        episodes: 4,
        steps: 10,
        seed: 1,
        stopOnViolation: true,
        time: { weight: 1, minMs: 1, maxMs: 40 },
      });
      expect(report.ok).toBe(true);
    },
    { timeout: 180_000 }
  );

  test('hold then increment then heal converges (pin)', async () => {
    await playRoomPin(counterSystem, {
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
    await playRoomPin(counterSystem, {
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
    await playRoomPin(counterSystem, {
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
    await using run = await playRoomActions(counterSystem, {
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
    expect(await run.observe(invariantViolations)).toEqual([]);
  });
});
