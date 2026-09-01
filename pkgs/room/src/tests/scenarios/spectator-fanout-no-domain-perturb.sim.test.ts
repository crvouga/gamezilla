import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: spectator fanout (E-H03)', () => {
  test('joining spectators does not change domain hash', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.system);
    const a = await world.addClient({ id: 'alice' });
    a.dispatch(Increment({}));
    await world.drain();
    const domainHash = a.hash();

    await world.addClient({ id: 'spec1' });
    await world.addClient({ id: 'spec2' });
    await world.assertConverged();

    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
    expect(a.hash()).toBe(domainHash);
    expect(world.server.getRoster()).toHaveLength(3);
  });
});
