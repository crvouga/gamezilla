import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: triad matrix smoke (E-A06)', () => {
  test('soft disconnect, hold, and down remain independent', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    const c = await world.addClient({ id: 'carol' });
    await world.assertConverged();

    // Soft disconnect: offline optimistic queue.
    await a.disconnect();
    a.dispatch(Increment({}));
    expect(a.isConnected()).toBe(false);
    expect(counterValue(a.snapshot())).toBe(1);

    // Hold: frames buffered, session still "connected".
    {
      using _hold = world.net('bob').set('hold');
      expect(b.isConnected()).toBe(true);
      c.dispatch(Increment({}));
      await world.drain();
      await world.never(() => counterValue(b.snapshot()) === 1, {
        forMs: 100,
      });
    }

    // Down: drop, then soft reconnect alice.
    {
      using _down = world.net('carol').set('down');
      b.dispatch(Increment({}));
      await world.drain();
    }

    await a.connect();
    await c.disconnect();
    await c.connect();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(3);
    expect(counterValue(a.snapshot())).toBe(3);
    expect(a.hash()).toBe(await world.serverHash());
    expect(b.hash()).toBe(await world.serverHash());
    expect(c.hash()).toBe(await world.serverHash());
  });
});
