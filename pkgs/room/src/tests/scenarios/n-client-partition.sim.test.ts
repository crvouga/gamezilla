import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: n-client partition (E-A07)', () => {
  test('selective holds across four clients converge', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const ids = ['a', 'b', 'c', 'd'] as const;
    const clients = [];
    for (const id of ids) {
      clients.push(await world.addClient({ id }));
    }
    await world.assertConverged();

    {
      using _b = world.net('b').set('hold');
      using _d = world.net('d').set('hold');
      clients[0]!.dispatch(Increment({}));
      clients[2]!.dispatch(Increment({}));
      await world.drain();
      expect(counterValue(clients[1]!.snapshot())).toBe(0);
      expect(counterValue(clients[3]!.snapshot())).toBe(0);
    }

    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(2);
    const serverHash = await world.serverHash();
    for (const c of clients) {
      expect(counterValue(c.snapshot())).toBe(2);
      expect(c.hash()).toBe(serverHash);
    }
  });
});
