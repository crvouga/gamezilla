import { describe, expect, test } from 'bun:test';
import type { RoomCommand, RoomState } from '@pkgs/room';
import { createSimAdapters } from '@pkgs/uuid';

import { ChessModule } from './chess-module';
import {
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from './chess-puzzle-play';

const HOST = 'host-1';
const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

function cmd(
  payload: RoomCommand['payload'],
  createId: () => string,
  ts: number
): RoomCommand {
  return { id: createId(), ts, payload };
}

function reduceAll(state: RoomState, events: readonly unknown[]): RoomState {
  let next = state;
  for (const ev of events) {
    next = ChessModule.reduce(next, ev as never);
  }
  return next;
}

function playOnce(seed: number): { hash: string; status: string | null } {
  const adapters = createSimAdapters({ seed, startMs: 1_000 });
  let state = ChessModule.initialState();
  const start = ChessModule.handle(
    state,
    cmd(
      StartChessPuzzlePlay({
        puzzleId: 'puzzle-1',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      }),
      adapters.createId,
      adapters.clock.now()
    ),
    HOST
  );
  if (!start.ok) throw new Error(JSON.stringify(start.error));
  state = reduceAll(state, start.events);

  // After Start, the first opponent UCI (`e8d7`) is already applied; host plays next.
  const move = ChessModule.handle(
    state,
    cmd(
      SubmitChessPuzzleMove({ uci: 'e1f2' }),
      adapters.createId,
      adapters.clock.now()
    ),
    HOST
  );
  if (!move.ok) throw new Error(JSON.stringify(move.error));
  state = reduceAll(state, move.events);

  return {
    hash: ChessModule.hash(state),
    status: ChessPuzzlePlayAttr.status.from(state),
  };
}

describe('chess module sim determinism', () => {
  test('same seed yields identical state hash twice', () => {
    const seed = Number(process.env['SIM_SEED'] ?? '42');
    const a = playOnce(seed);
    const b = playOnce(seed);
    expect(a.hash).toBe(b.hash);
    expect(a.status).toBe(b.status);
    expect(a.hash.length).toBe(16);
  });
});
