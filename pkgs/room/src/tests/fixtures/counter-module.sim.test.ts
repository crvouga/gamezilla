import { describe, expect, test } from 'bun:test';
import { createSimIo } from '@pkgs/io';
import type { RoomCommand, RoomState } from '../../types';
import { Increment, TestCounterModule } from './counter-module';

function reduceAll(state: RoomState, events: readonly unknown[]): RoomState {
  let next = state;
  for (const ev of events) {
    next = TestCounterModule.reduce(next, ev as never);
  }
  return next;
}

function runCounter(seed: number): string {
  const io = createSimIo({ seed, startMs: 0 });
  let state = TestCounterModule.initialState();
  for (let i = 0; i < 5; i++) {
    const res = TestCounterModule.handle(
      state,
      {
        id: io.createId(),
        ts: io.clock.now(),
        payload: Increment({}),
      } satisfies RoomCommand,
      'alice'
    );
    if (!res.ok) throw new Error(JSON.stringify(res.error));
    state = reduceAll(state, res.events);
  }
  return TestCounterModule.hash(state);
}

describe('test counter module sim determinism', () => {
  test('same seed yields identical state hash twice', () => {
    const seed = Number(process.env['SIM_SEED'] ?? '7');
    expect(runCounter(seed)).toBe(runCounter(seed));
  });
});
