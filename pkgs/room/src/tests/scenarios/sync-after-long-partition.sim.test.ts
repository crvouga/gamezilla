import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/dst';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: sync after long partition (E-C01)', () => {
  test('many commits behind hold catch up on heal', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    {
      using _hold = world.net('bob').set('hold');
      for (let i = 0; i < 20; i += 1) {
        a.dispatch(Increment({}));
        await world.drain();
      }
      expect(counterValue(b.snapshot())).toBe(0);
    }

    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(20);
    expect(counterValue(a.snapshot())).toBe(20);
    expect(counterValue(b.snapshot())).toBe(20);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
