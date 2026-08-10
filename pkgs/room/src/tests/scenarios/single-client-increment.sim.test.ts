import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: single client increment', () => {
  test('increment converges to server hash', async () => {
    await using world = await openRoomSimWorld({
      seed: 1,
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    expect(a.isSynced()).toBe(true);
    a.dispatch(Increment({}));
    await world.assertConverged();
    expect(counterValue(a.snapshot())).toBe(1);
  });
});
