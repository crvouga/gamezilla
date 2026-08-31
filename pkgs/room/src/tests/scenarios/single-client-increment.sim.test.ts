import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: single client increment', () => {
  test('increment converges to server hash', async () => {
    await using world = await openWorld({
      seed: 1,
      module: TestCounterModule,
    });
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
