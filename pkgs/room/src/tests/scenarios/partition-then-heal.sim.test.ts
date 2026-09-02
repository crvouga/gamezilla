import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/dst';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: partition then heal', () => {
  test('held peer never sees write until heal + converge', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 3,
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();
    const bobBefore = b.hash();

    {
      using _hold = world.net('bob').set('hold');
      a.dispatch(Increment({}));
      await world.drain();
      await world.waitNever(() => counterValue(b.snapshot()) === 1, {
        forMs: 200,
      });
      expect(b.hash()).toBe(bobBefore);
    }

    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
