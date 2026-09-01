import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: down during welcome (E-A03)', () => {
  test('join under down then heal converges', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.state);
    const a = await world.addClient({ id: 'alice' });
    a.dispatch(Increment({}));
    a.dispatch(Increment({}));
    await world.drain();

    {
      using _down = world.net('bob').set('down');
      const b = await world.addClient({ id: 'bob' });
      await world.drain();
      // May or may not be synced depending on whether welcome was dropped.
      void b;
    }

    const b = world.clients.get('bob');
    expect(b).toBeDefined();
    await b!.disconnect();
    await b!.connect();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(2);
    expect(counterValue(a.snapshot())).toBe(2);
    expect(counterValue(b!.snapshot())).toBe(2);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
