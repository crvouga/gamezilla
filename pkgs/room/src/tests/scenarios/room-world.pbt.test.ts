import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { counterDstApp } from '../apps/counter/dst-app';
import { replayActionsOnWorld } from '../dst/commands';
import { openPbtWorld } from '../dst/world-config';
import {
  runShrunkWorldProperty,
  worldPropertyInputs,
} from '../dst/world-runner';

describe('room world PBT / DST', () => {
  test(
    'fc.commands sequences replay on RoomSimWorld and converge',
    async () => {
      await assertDstProperty(
        'room world converges',
        fc.asyncProperty(
          worldPropertyInputs(counterDstApp, 14),
          async ([seed, knobs, cmds]) => {
            await runShrunkWorldProperty({
              app: counterDstApp,
              seed,
              knobs,
              cmds,
            });
          }
        )
      );
    },
    { timeout: 180_000 }
  );

  test('hold then increment then heal converges (pin)', async () => {
    const opened = await openPbtWorld({
      app: counterDstApp,
      seed: 42,
      knobs: { clientCount: 2, mildFaults: false },
    });
    try {
      await replayActionsOnWorld(counterDstApp, opened.world, [
        { kind: 'hold', clientId: 'c1' },
        {
          kind: 'domain',
          clientId: 'c0',
          command: 'increment',
          args: {},
        },
        { kind: 'idle', ms: 20 },
        { kind: 'heal' },
      ]);
      await opened.world.assertConverged();
    } finally {
      await opened.world.dispose();
    }
  });

  test('crash then restart with pending offline queue converges (pin)', async () => {
    const opened = await openPbtWorld({
      app: counterDstApp,
      seed: 99,
      knobs: { clientCount: 2, mildFaults: false },
    });
    try {
      await replayActionsOnWorld(counterDstApp, opened.world, [
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
      ]);
      await opened.world.assertConverged();
    } finally {
      await opened.world.dispose();
    }
  });

  test('armCrashAt afterNextCommitted then settle (pin FC_SEED=665742204)', async () => {
    const opened = await openPbtWorld({
      app: counterDstApp,
      seed: 706975,
      knobs: { clientCount: 2, mildFaults: false },
    });
    try {
      await replayActionsOnWorld(counterDstApp, opened.world, [
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
      ]);
      await opened.world.assertConverged();
    } finally {
      await opened.world.dispose();
    }
  });
});
