import { describe, expect, test } from 'bun:test';
import type { Message } from '@gamezilla/lib/message';

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
      id: crypto.randomUUID(),
      ts: Date.now(),
      payload: Increment({}),
    };
    const h = CounterModule.handle(state0, cmd, 'account');
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.events.length).toBe(1);
    const ev = h.events[0]! as Message;
    expect(CounterIncremented.is(ev)).toBe(true);
    const s1 = CounterModule.reduce(state0, ev);
    expect(s1['count']).toBe(1);
  });

  test('decrement', () => {
    const state0 = { count: 2 };
    const cmd = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      payload: Decrement({}),
    };
    const h = CounterModule.handle(state0, cmd, 'account');
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const ev = h.events[0]! as Message;
    expect(CounterDecremented.is(ev)).toBe(true);
    const s1 = CounterModule.reduce(state0, ev);
    expect(s1['count']).toBe(1);
  });
});
