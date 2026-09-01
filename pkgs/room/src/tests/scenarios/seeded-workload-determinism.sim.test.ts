import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { Increment } from '../fixtures/counter-module';

async function runWorkload(seed: number | string): Promise<string> {
  await using host = await openWorld(counterSystem, {
    seed,
    knobs: { clientCount: 0 },
  });
  const world = roomWorld(host.system);
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });
  for (let i = 0; i < 7; i += 1) {
    if (i % 2 === 0) a.dispatch(Increment({}));
    else b.dispatch(Increment({}));
    await world.drain();
  }
  {
    using _hold = world.net('bob').set('hold');
    a.dispatch(Increment({}));
    await world.drain();
  }
  await world.assertConverged();
  return `${await world.serverHash()}:${a.hash()}:${b.hash()}`;
}

describe('room sim: seeded workload determinism', () => {
  test('same seed yields identical multi-client hash twice', async () => {
    const seed = process.env['SIM_SEED'] ?? '42';
    const once = await runWorkload(seed);
    const twice = await runWorkload(seed);
    expect(once).toBe(twice);
  });
});
