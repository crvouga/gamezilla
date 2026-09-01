import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: down then heal (E-A02)', () => {
  test('down drops frames; heal + resync converges', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();
    const bobBefore = b.hash();

    {
      using _down = world.net('bob').set('down');
      a.dispatch(Increment({}));
      await world.drain();
      await world.never(() => counterValue(b.snapshot()) === 1, {
        forMs: 200,
      });
      expect(b.hash()).toBe(bobBefore);
    }

    await b.disconnect();
    await b.connect();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
