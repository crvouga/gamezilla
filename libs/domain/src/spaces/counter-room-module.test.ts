import { describe, expect, test } from 'bun:test';
import { generateId } from '@gamezilla/room';

import {
  CounterDecremented,
  CounterIncremented,
  CounterModule,
  Decrement,
  Increment,
} from './counter-room-module';

describe('CounterModule', () => {
  test('increment then reduce', () => {
    const state0 = CounterModule.initialState();
    const cmd = {
      id: generateId(),
      seq: 1,
      peerId: 'test-peer',
      message: Increment({}),
    };
    const h = CounterModule.handle(state0, cmd);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.events.length).toBe(1);
    const ev = h.events[0]!;
    expect(CounterIncremented.is(ev)).toBe(true);
    const s1 = CounterModule.reduce(state0, ev);
    expect(s1['count']).toBe(1);
  });

  test('decrement', () => {
    const state0 = { count: 2 };
    const cmd = {
      id: generateId(),
      seq: 1,
      peerId: 'test-peer',
      message: Decrement({}),
    };
    const h = CounterModule.handle(state0, cmd);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const ev = h.events[0]!;
    expect(CounterDecremented.is(ev)).toBe(true);
    const s1 = CounterModule.reduce(state0, ev);
    expect(s1['count']).toBe(1);
  });
});
