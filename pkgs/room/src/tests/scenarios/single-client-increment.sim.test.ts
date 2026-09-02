import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/dst';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: single client increment', () => {
  test('increment converges to server hash', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 1,
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    expect(a.isSynced()).toBe(true);
    a.dispatch(Increment({}));
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
