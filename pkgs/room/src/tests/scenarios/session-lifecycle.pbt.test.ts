import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { arbWorldSeed, assertSampleProperty } from '@pkgs/determinism/pbt';
import { fc } from '@pkgs/pbt';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { arbRoomKnobs, replayRoom, roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

async function expectCounter(
  world: Awaited<ReturnType<typeof replayRoom>>,
  expected: number
): Promise<void> {
  try {
    const snap = await roomWorld(world.state).serverSnapshot();
    expect(counterValue(snap)).toBe(expected);
  } finally {
    await world.dispose();
  }
}

describe('room session-lifecycle PBT', () => {
  test(
    'takeOver mid-flight converges',
    async () => {
      await assertSampleProperty(
        'takeOver sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbRoomKnobs(),
          async (seed, knobs) => {
            const world = await replayRoom(counterSystem, {
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
            await expectCounter(world, 2);
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'crash restart clearLocalData converge',
    async () => {
      await assertSampleProperty(
        'lifecycle sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbRoomKnobs(),
          async (seed, knobs) => {
            const world = await replayRoom(counterSystem, {
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
            await world.dispose();
          }
        ),
        { numRuns: 8 }
      );
    },
    { timeout: 120_000 }
  );

  test(
    'serverCrash restart drains pending',
    async () => {
      await assertSampleProperty(
        'server crash sequences converge',
        fc.asyncProperty(arbWorldSeed(), async (seed) => {
          const world = await replayRoom(counterSystem, {
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
          await expectCounter(world, 2);
        }),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );

  test('commandId replay across takeOver applies once', async () => {
    const world = await replayRoom(counterSystem, {
      seed: 7,
      settle: false,
      actions: [],
    });
    const real = roomWorld(world.state);
    try {
      const c0 = real.clients.get('c0')!;
      const frame = {
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.command,
        id: 'same-cmd',
        ts: real.clock.now(),
        payload: Increment({}),
      };
      c0.injectToServer(frame, { direct: true });
      await real.drain();
      await real.node('c0').takeOver();
      c0.injectToServer(frame, { direct: true });
      await real.drain();
      await real.assertConverged();
      expect(counterValue(await real.serverSnapshot())).toBe(1);
    } finally {
      await world.dispose();
    }
  });

  test('multi-tab same identity converges', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 11,
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.state);
    await world.addClient({
      id: 'tab-a',
      identity: 'user',
      clientId: 'a',
    });
    await world.addClient({
      id: 'tab-b',
      identity: 'user',
      clientId: 'b',
    });
    world.clients.get('tab-a')!.dispatch(Increment({}));
    world.clients.get('tab-b')!.dispatch(Increment({}));
    await world.assertConverged();
    expect(counterValue(await world.serverSnapshot())).toBe(2);
  });
});
