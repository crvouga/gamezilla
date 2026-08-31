import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: hold during sync (E-A05)', () => {
  test('release mid catch-up still converges', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
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
