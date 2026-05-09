import { describe, expect, test } from 'bun:test';

import { SpaceModule } from '../../../space-module';
import {
  ChessPuzzleSessionAttr,
  SelectChessPuzzle,
} from './chess-puzzle-session';
import type { RoomCommand } from '@gamezilla/room';

describe('chess puzzle session', () => {
  test('SelectChessPuzzle sets selectedPuzzleId on room state', () => {
    let state = SpaceModule.initialState();
    expect(ChessPuzzleSessionAttr.selectedPuzzleId.from(state)).toBeNull();

    const cmd: RoomCommand = {
      id: '1',
      ts: 1,
      payload: SelectChessPuzzle({ puzzleId: 'abc123' }),
    };
    const res = SpaceModule.handle(state, cmd, 'test-identity');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    for (const ev of res.events) {
      state = SpaceModule.reduce(state, ev);
    }
    expect(ChessPuzzleSessionAttr.selectedPuzzleId.from(state)).toBe('abc123');
  });

  test('SelectChessPuzzle with null clears selection', () => {
    let state = SpaceModule.initialState();
    const set: RoomCommand = {
      id: '1',
      ts: 1,
      payload: SelectChessPuzzle({ puzzleId: 'xyz' }),
    };
    const r1 = SpaceModule.handle(state, set, 'i');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    for (const ev of r1.events) {
      state = SpaceModule.reduce(state, ev);
    }
    const clear: RoomCommand = {
      id: '2',
      ts: 2,
      payload: SelectChessPuzzle({ puzzleId: null }),
    };
    const r2 = SpaceModule.handle(state, clear, 'i');
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    for (const ev of r2.events) {
      state = SpaceModule.reduce(state, ev);
    }
    expect(ChessPuzzleSessionAttr.selectedPuzzleId.from(state)).toBeNull();
  });
});
