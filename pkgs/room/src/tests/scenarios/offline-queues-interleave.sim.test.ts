import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: offline queues interleave (E-B03)', () => {
  test('both offline queues flush; server order wins', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    const c = await world.addClient({ id: 'carol' });
    await world.assertConverged();

    await a.disconnect();
    await b.disconnect();
    a.dispatch(Increment({}));
    a.dispatch(Increment({}));
    b.dispatch(Increment({}));

    // Interim commits while alice/bob offline.
    c.dispatch(Increment({}));
    await world.drain();
    expect(counterValue(c.snapshot())).toBe(1);

    await a.connect();
    await b.connect();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(4);
    expect(counterValue(a.snapshot())).toBe(4);
    expect(a.hash()).toBe(await world.serverHash());
    expect(b.hash()).toBe(await world.serverHash());
    expect(c.hash()).toBe(await world.serverHash());
  });
});
