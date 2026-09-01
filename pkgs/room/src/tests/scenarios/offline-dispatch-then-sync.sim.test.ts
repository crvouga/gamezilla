import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: offline dispatch then sync', () => {
  test('optimistic increment flushes after reconnect', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 4,
      knobs: { clientCount: 0 },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    await a.disconnect();
    expect(a.isConnected()).toBe(false);
    a.dispatch(Increment({}));
    expect(counterValue(a.snapshot())).toBe(1);
    expect(a.isSynced()).toBe(false);

    await world.never(() => counterValue(b.snapshot()) === 1, { forMs: 100 });

    await a.connect();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
