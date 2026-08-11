import { describe, expect, test } from 'bun:test';
import { createSimIo } from '@pkgs/io';

import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';
import { assertHashCanonical } from './assert-hash-canonical';

describe('kit: hash canonicality (M-F02)', () => {
  test('counter states hash independent of key insertion order', () => {
    const io = createSimIo({
      seed: process.env['SIM_SEED'] ?? '42',
      startMs: 1,
    });
    let state = TestCounterModule.initialState();
    for (let i = 0; i < 3; i += 1) {
      const res = TestCounterModule.handle(
        state,
        { id: io.createId(), ts: io.clock.now(), payload: Increment({}) },
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
