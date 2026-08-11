import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: asymmetric link (P2)', () => {
  test('toClient hold blocks fanout while toServer still works', async () => {
    await using world = await openRoomSimWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    {
      using _dir = world.net('bob').set({ toClient: 'hold', toServer: 'ok' });
      // Bob can still send to server.
      b.dispatch(Increment({}));
      await world.drain();
      expect(counterValue(a.snapshot())).toBe(1);
      // Alice's commits do not reach bob while toClient held.
      a.dispatch(Increment({}));
      await world.drain();
      await world.never(() => counterValue(b.snapshot()) === 2, {
        forMs: 120,
      });
    }

    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(2);
    expect(counterValue(a.snapshot())).toBe(2);
    expect(counterValue(b.snapshot())).toBe(2);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
