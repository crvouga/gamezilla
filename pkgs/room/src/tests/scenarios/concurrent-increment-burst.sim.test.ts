import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/dst';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: concurrent increment burst (E-B01)', () => {
  test('three clients burst N each → count and hashes match', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0, mildFaults: true },
    });
    const world = host;
    const clients = [
      await world.addClient({ id: 'alice' }),
      await world.addClient({ id: 'bob' }),
      await world.addClient({ id: 'carol' }),
    ];
    await world.assertConverged();

    const perClient = 5;
    for (let i = 0; i < perClient; i += 1) {
      for (const c of clients) c.dispatch(Increment({}));
    }
    await world.assertConverged();
    const expected = perClient * clients.length;
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(expected);
    const serverHash = await world.serverHash();
    for (const c of clients) {
      expect(counterValue(c.snapshot())).toBe(expected);
      expect(c.hash()).toBe(serverHash);
    }
  });
});
