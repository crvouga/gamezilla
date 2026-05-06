import { describe, expect, test } from 'bun:test';
import type { Message } from '@gamezilla/lib/message';

import {
  CounterDecremented,
  CounterIncremented,
  Decrement,
  GameSelected,
  Increment,
  SelectGame,
  SpaceGame,
  SpaceModule,
} from './space-module';

describe('SpaceModule', () => {
  test('increment then reduce', () => {
    const state0 = SpaceModule.initialState();
    const cmd = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      payload: Increment({}),
    };
    const h = SpaceModule.handle(state0, cmd, 'account');
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.events.length).toBe(1);
    const ev = h.events[0]! as Message;
    expect(CounterIncremented.is(ev)).toBe(true);
    const s1 = SpaceModule.reduce(state0, ev);
    expect(s1['count']).toBe(1);
  });

  test('decrement', () => {
    const state0 = { count: 2 };
    const cmd = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      payload: Decrement({}),
    };
    const h = SpaceModule.handle(state0, cmd, 'account');
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const ev = h.events[0]! as Message;
    expect(CounterDecremented.is(ev)).toBe(true);
    const s1 = SpaceModule.reduce(state0, ev);
    expect(s1['count']).toBe(1);
  });

  test('host picks chess game', () => {
    const state0 = SpaceModule.initialState();
    const cmd = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      payload: SelectGame({ game: SpaceGame.chess }),
    };
    const h = SpaceModule.handle(state0, cmd, 'account');
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.events.length).toBe(1);
    const ev = h.events[0]! as Message;
    expect(GameSelected.is(ev)).toBe(true);
    const s1 = SpaceModule.reduce(state0, ev);
    expect(s1['selectedGame']).toBe(SpaceGame.chess);
  });
});
