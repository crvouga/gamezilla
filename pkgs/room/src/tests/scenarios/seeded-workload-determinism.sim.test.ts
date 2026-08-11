import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import { Increment, TestCounterModule } from '../fixtures/counter-module';

async function runWorkload(seed: number | string): Promise<string> {
  await using world = await openRoomSimWorld({
    seed,
    module: TestCounterModule,
  });
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
