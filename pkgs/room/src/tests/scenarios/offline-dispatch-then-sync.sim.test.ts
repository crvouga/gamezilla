import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: offline dispatch then sync', () => {
  test('optimistic increment flushes after reconnect', async () => {
    await using world = await openRoomSimWorld({
      seed: 4,
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    await a.disconnect();
    expect(a.isConnected()).toBe(false);
    a.dispatch(Increment({}));
    expect(counterValue(a.snapshot())).toBe(1);
    expect(a.isSynced()).toBe(false);

    await world.never(() => counterValue(b.snapshot()) === 1, { forMs: 100 });

    await a.connect();
    await world.assertConverged();
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(b.hash());
  });
});
