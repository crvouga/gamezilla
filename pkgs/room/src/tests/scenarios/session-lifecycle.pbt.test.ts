import { describe, expect, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { openWorld } from '../../sim/world';
import { counterDstApp } from '../apps/counter/dst-app';
import { arbWorldKnobs, arbWorldSeed } from '../dst/world-config';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room session-lifecycle PBT', () => {
  test(
    'takeOver mid-flight converges',
    async () => {
      await assertDstProperty(
        'takeOver sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          async (seed, knobs) => {
            await using world = await openWorld({
              app: counterDstApp,
              seed,
              knobs,
            });
            await world.playActions([
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
            ]);
            await world.assertConverged();
            expect(counterValue(await world.serverSnapshot())).toBe(2);
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
      await assertDstProperty(
        'lifecycle sequences converge',
        fc.asyncProperty(
          arbWorldSeed(),
          arbWorldKnobs(),
          async (seed, knobs) => {
            await using world = await openWorld({
              app: counterDstApp,
              seed,
              knobs,
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
              { kind: 'clearLocalData', clientId: 'c1' },
              {
                kind: 'domain',
                clientId: 'c1',
                command: 'increment',
                args: {},
              },
            ]);
            await world.assertConverged();
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
      await assertDstProperty(
        'server crash sequences converge',
        fc.asyncProperty(arbWorldSeed(), async (seed) => {
          await using world = await openWorld({
            app: counterDstApp,
            seed,
            knobs: { clientCount: 2, mildFaults: false },
          });
          await world.playActions([
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
          ]);
          await world.assertConverged();
          expect(counterValue(await world.serverSnapshot())).toBe(2);
        }),
        { numRuns: 6 }
      );
    },
    { timeout: 120_000 }
  );

  test('commandId replay across takeOver applies once', async () => {
    await using world = await openWorld({
      app: counterDstApp,
      seed: 7,
      knobs: { clientCount: 2, mildFaults: false },
    });
    const c0 = world.clients.get('c0')!;
    const frame = {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.command,
      id: 'same-cmd',
      ts: world.clock.now(),
      payload: Increment({}),
    };
    c0.injectToServer(frame, { direct: true });
    await world.drain();
    await world.node('c0').takeOver();
    c0.injectToServer(frame, { direct: true });
    await world.drain();
    await world.assertConverged();
    expect(counterValue(await world.serverSnapshot())).toBe(1);
  });

  test('multi-tab same identity converges', async () => {
    await using world = await openWorld({
      seed: 11,
      module: counterDstApp.module,
    });
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
