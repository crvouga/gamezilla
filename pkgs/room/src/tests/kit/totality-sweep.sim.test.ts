import { describe, test } from 'bun:test';
import { createSimIo } from '@pkgs/io';

import {
  Decrement,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';
import { assertTotality } from './assert-totality';

describe('kit: totality sweep (M-F03)', () => {
  test('counter handle never throws across corpus', () => {
    const io = createSimIo({
      seed: process.env['SIM_SEED'] ?? '42',
      startMs: 1,
    });
    const states = [TestCounterModule.initialState()];
    const commands = [
      {
        id: io.createId(),
        ts: io.clock.now(),
        payload: Increment({}),
      },
      {
        id: io.createId(),
        ts: io.clock.now(),
        payload: Decrement({}),
      },
      {
        id: io.createId(),
        ts: io.clock.now(),
        payload: {
          type: 'space-counter-cmd/nope',
          payload: {},
        } as never,
      },
    ];
    assertTotality({
      module: TestCounterModule,
      states,
      commands,
      identities: ['alice', 'bob'],
    });
  });
});
