import { describe, expect, test } from 'bun:test';
import { createSimAdapters } from '@pkgs/uuid';

import {
  counterValue,
  Decrement,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('kit: fold closure (M-F04)', () => {
  test('reduce over server-ordered log stays valid', () => {
    const adapters = createSimAdapters({
      seed: process.env['SIM_SEED'] ?? '42',
      startMs: 1,
    });
    let state = TestCounterModule.initialState();
    const events = [];
    for (let i = 0; i < 10; i += 1) {
      const payload = i % 3 === 0 ? Decrement({}) : Increment({});
      const res = TestCounterModule.handle(
        state,
        { id: adapters.createId(), ts: adapters.clock.now(), payload },
        'alice'
      );
      if (!res.ok) throw new Error('expected ok');
      events.push(...res.events);
      for (const ev of res.events) state = TestCounterModule.reduce(state, ev);
    }
    let folded = TestCounterModule.initialState();
    for (const ev of events) {
      folded = TestCounterModule.reduce(folded, ev);
      expect(Number.isInteger(counterValue(folded))).toBe(true);
    }
    expect(TestCounterModule.hash(folded)).toBe(TestCounterModule.hash(state));
  });
});
