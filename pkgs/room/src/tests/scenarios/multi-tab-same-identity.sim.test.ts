import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: multi-tab same identity (E-C03)', () => {
  test('two tabs same identity fold identically', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host.facade;
    const t1 = await world.addClient({
      id: 'tab1',
      identity: 'alice',
      clientId: 'tab-1',
    });
    const t2 = await world.addClient({
      id: 'tab2',
      identity: 'alice',
      clientId: 'tab-2',
    });
    await world.assertConverged();

    t1.dispatch(Increment({}));
    t2.dispatch(Increment({}));
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(2);
    expect(counterValue(t1.snapshot())).toBe(2);
    expect(counterValue(t2.snapshot())).toBe(2);
    expect(t1.hash()).toBe(await world.serverHash());
    expect(world.server.getRoster()).toHaveLength(2);
  });
});
