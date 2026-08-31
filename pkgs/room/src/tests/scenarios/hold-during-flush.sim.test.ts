import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: hold during flush (E-A01)', () => {
  test('offline queue + peer hold still converges after heal', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    await a.disconnect();
    a.dispatch(Increment({}));
    expect(counterValue(a.snapshot())).toBe(1);

    {
      using _hold = world.net('bob').set('hold');
      await a.connect();
      await world.drain();
      await world.never(() => counterValue(b.snapshot()) === 1, {
        forMs: 150,
      });
    }

    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
  });
});
