import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: partition then heal', () => {
  test('held peer never sees write until heal + converge', async () => {
    await using world = await openRoomSimWorld({
      seed: 3,
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();
    const bobBefore = b.hash();

    {
      using _hold = world.net('bob').set('hold');
      a.dispatch(Increment({}));
      await world.drain();
      await world.never(() => counterValue(b.snapshot()) === 1, {
        forMs: 200,
      });
      expect(b.hash()).toBe(bobBefore);
    }

    await world.assertConverged();
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(b.hash());
  });
});
