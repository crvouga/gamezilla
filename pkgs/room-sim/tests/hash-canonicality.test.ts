import { describe, expect, test } from 'bun:test';
import {
  assertHashCanonical,
  counterValue,
  Increment,
  TestCounterModule,
} from '@pkgs/room-sim';
import { createSimAdapters } from '@pkgs/uuid';

describe('kit: hash canonicality (M-F02)', () => {
  test('counter states hash independent of key insertion order', () => {
    const adapters = createSimAdapters({
      seed: process.env['SIM_SEED'] ?? '42',
      startMs: 1,
    });
    let state = TestCounterModule.initialState();
    for (let i = 0; i < 3; i += 1) {
      const res = TestCounterModule.handle(
        state,
        {
          id: adapters.createId(),
          ts: adapters.clock.now(),
          payload: Increment({}),
        },
        'alice'
      );
      if (!res.ok) throw new Error('expected ok');
      for (const ev of res.events) state = TestCounterModule.reduce(state, ev);
    }
    expect(counterValue(state)).toBe(3);
    assertHashCanonical(TestCounterModule, [
      TestCounterModule.initialState(),
      state,
    ]);
  });
});
