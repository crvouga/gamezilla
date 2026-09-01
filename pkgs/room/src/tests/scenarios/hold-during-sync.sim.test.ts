import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: hold during sync (E-A05)', () => {
  test('release mid catch-up still converges', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.state);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    const hold = world.net('bob').set('hold');
    for (let i = 0; i < 12; i += 1) {
      a.dispatch(Increment({}));
    }
    await world.drain();
    expect(counterValue(b.snapshot())).toBe(0);
    hold.restore();
    await world.drain();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(12);
    expect(counterValue(a.snapshot())).toBe(12);
    expect(counterValue(b.snapshot())).toBe(12);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
