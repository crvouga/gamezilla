import { describe, expect, test } from 'bun:test';
import type { Message } from '@gamezilla/lib/message';

import {
  CHESS_MAIN_MENU_PUZZLE,
  CHESS_MAIN_MENU_ROOT,
  ChessMainMenuScreenAttr,
  CounterDecremented,
  CounterIncremented,
  CounterRoomAttr,
  Decrement,
  GameSelected,
  GamesRoomAttr,
  Increment,
  SelectGame,
  SetChessMainMenuScreen,
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
    expect(s1[CounterRoomAttr.count.key]).toBe(1);
  });

  test('decrement', () => {
    const state0 = { [CounterRoomAttr.count.key]: 2 };
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
    expect(s1[CounterRoomAttr.count.key]).toBe(1);
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
    expect(s1[GamesRoomAttr.selected.key]).toBe(SpaceGame.chess);
  });

  test('chess main menu screen in room state', () => {
    const state0 = SpaceModule.initialState();
    expect(ChessMainMenuScreenAttr.screen.from(state0)).toBe(CHESS_MAIN_MENU_ROOT);
    const cmd = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      payload: SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_PUZZLE }),
    };
    const h = SpaceModule.handle(state0, cmd, 'account');
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const ev = h.events[0]!;
    const s1 = SpaceModule.reduce(state0, ev);
    expect(ChessMainMenuScreenAttr.screen.from(s1)).toBe(CHESS_MAIN_MENU_PUZZLE);
  });
});
