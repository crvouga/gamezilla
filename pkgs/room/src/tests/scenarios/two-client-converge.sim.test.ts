import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: two client converge', () => {
  test('mutual increments yield equal hashes and roster', async () => {
    await using world = await openRoomSimWorld({
      seed: 2,
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    a.dispatch(Increment({}));
    b.dispatch(Increment({}));
    a.dispatch(Increment({}));
    await world.assertConverged();
    expect(a.hash()).toBe(b.hash());
    expect(counterValue(a.snapshot())).toBe(3);
    expect(counterValue(b.snapshot())).toBe(3);
    const room = a.room();
    expect(room).not.toBeNull();
    expect(room!.getRoster().length).toBe(2);
  });
});
