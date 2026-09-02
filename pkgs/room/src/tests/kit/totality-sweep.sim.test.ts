import { describe, test } from 'bun:test';
import { createSimAdapters } from '@pkgs/uuid';

import {
  Decrement,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';
import { assertTotality } from './assert-totality';

describe('kit: totality sweep (M-F03)', () => {
  test('counter handle never throws across corpus', () => {
    const adapters = createSimAdapters({
      seed: process.env['SIM_SEED'] ?? '42',
      startMs: 1,
    });
    const states = [TestCounterModule.initialState()];
    const commands = [
      {
        id: adapters.createId(),
        ts: adapters.clock.now(),
        payload: Increment({}),
      },
      {
        id: adapters.createId(),
        ts: adapters.clock.now(),
        payload: Decrement({}),
      },
      {
        id: adapters.createId(),
        ts: adapters.clock.now(),
        payload: {
          type: 'space-counter-cmd/nope',
          payload: {},
        } as never,
      },
    ];
    assertTotality({
      module: TestCounterModule,
      states,
      actions: commands,
      identities: ['alice', 'bob'],
    });
  });
});
