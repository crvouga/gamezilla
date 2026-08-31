import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { openWorld } from '../../sim/world';
import { counterDstApp } from '../apps/counter/dst-app';
import { worldPropertyInputs } from '../dst/world-runner';

describe('room world PBT / DST', () => {
  test(
    'fc.commands sequences replay on World and converge',
    async () => {
      await assertDstProperty(
        'room world converges',
        fc.asyncProperty(
          worldPropertyInputs(counterDstApp, 14),
          async ([seed, knobs, cmds]) => {
            await using world = await openWorld({
              app: counterDstApp,
              seed,
              knobs,
            });
            await world.runCommands(cmds);
          }
        )
      );
    },
    { timeout: 180_000 }
  );

  test('hold then increment then heal converges (pin)', async () => {
    await using world = await openWorld({
      app: counterDstApp,
      seed: 42,
      knobs: { clientCount: 2, mildFaults: false },
    });
    await world.playActions([
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
    await world.assertConverged();
  });

  test('crash then restart with pending offline queue converges (pin)', async () => {
    await using world = await openWorld({
      app: counterDstApp,
      seed: 99,
      knobs: { clientCount: 2, mildFaults: false },
    });
    await world.playActions([
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
    await world.assertConverged();
  });

  test('armCrashAt afterNextCommitted then settle (pin FC_SEED=665742204)', async () => {
    await using world = await openWorld({
      app: counterDstApp,
      seed: 706975,
      knobs: { clientCount: 2, mildFaults: false },
    });
    await world.playActions([
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
    await world.assertConverged();
  });

  test('ghost durable queue: dispatch then settle leaves queues empty (pin)', async () => {
    await using world = await openWorld({
      app: counterDstApp,
      seed: 4242,
      knobs: { clientCount: 2, mildFaults: false },
    });
    await world.playActions([
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
    ]);
    await world.assertConverged();
    const inv = await world.checkInvariants();
    if (inv !== null) {
      throw new Error(`${inv.invariant}: ${inv.detail}`);
    }
  });
});
