import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  addClient,
  arbRoomKnobs,
  arbSeed,
  clock,
  converge,
  dispatch,
  injectToServer,
  replayRoom,
  startRoom,
  takeOver,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';
import { readServer } from '../scenario/read-state';

describe('room session-lifecycle PBT', () => {
  test(
    'takeOver mid-flight converges',
    async () => {
      await assertProperty(
        'takeOver mid-flight',
        fc.asyncProperty(arbSeed(), arbRoomKnobs(), async (seed, knobs) => {
          await using run = await replayRoom(counterSystem, {
            seed,
            knobs,
            actions: [
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'increment',
                args: {},
              },
              { kind: 'takeOver', clientId: 'c0' },
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'increment',
                args: {},
              },
            ],
          });
          expect(counterValue(await readServer(run))).toBe(2);
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'crash restart clearLocalData converge',
    async () => {
      await assertProperty(
        'crash restart clearLocalData',
        fc.asyncProperty(arbSeed(), arbRoomKnobs(), async (seed, knobs) => {
          await using _run = await replayRoom(counterSystem, {
            seed,
            knobs,
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
              { kind: 'clearLocalData', clientId: 'c1' },
              {
                kind: 'domain',
                clientId: 'c1',
                command: 'increment',
                args: {},
              },
            ],
          });
        }),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'serverCrash restart drains pending',
    async () => {
      await assertProperty(
        'serverCrash restart',
        fc.asyncProperty(arbSeed(), async (seed) => {
          await using run = await replayRoom(counterSystem, {
            seed,
            actions: [
              {
                kind: 'domain',
                clientId: 'c0',
                command: 'increment',
                args: {},
              },
              { kind: 'serverCrash' },
              { kind: 'serverRestart' },
              {
                kind: 'domain',
                clientId: 'c1',
                command: 'increment',
                args: {},
              },
            ],
          });
          expect(counterValue(await readServer(run))).toBe(2);
        }),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );

  test('commandId replay across takeOver applies once', async () => {
    await using run = await startRoom(counterSystem, {
      seed: 7,
      clientCount: 2,
    });
    const frame = {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.command,
      id: 'same-cmd',
      ts: await run.observe(clock),
      payload: Increment({}),
    };
    await run.apply(injectToServer, {
      clientId: 'c0',
      raw: frame,
      direct: true,
    });
    await run.apply(takeOver, 'c0');
    await run.apply(injectToServer, {
      clientId: 'c0',
      raw: frame,
      direct: true,
    });
    await run.apply(converge);
    expect(counterValue(await readServer(run))).toBe(1);
  });

  test('multi-tab same identity converges', async () => {
    await using run = await startRoom(counterSystem, { seed: 11 });
    await run.apply(addClient, {
      id: 'tab-a',
      identity: 'user',
      clientId: 'a',
    });
    await run.apply(addClient, {
      id: 'tab-b',
      identity: 'user',
      clientId: 'b',
    });
    await run.apply(dispatch, {
      clientId: 'tab-a',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'tab-b',
      payload: Increment({}),
    });
    await run.apply(converge);
    expect(counterValue(await readServer(run))).toBe(2);
  });
});
