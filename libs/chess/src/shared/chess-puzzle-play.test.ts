import { describe, expect, test } from 'bun:test';
import { ROOM_ERROR_TYPE, type RoomCommand, type RoomState } from '@pkgs/room';

import { ChessModule } from './chess-module';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  ClearChessPuzzlePlay,
  ReclaimChessPuzzlePlay,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  StartChessPuzzlePlay,
  StepBackChessPuzzlePlay,
  StepForwardChessPuzzlePlay,
  SeekChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from './chess-puzzle-play';

const HOST = 'host-1';
const GUEST = 'guest-1';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';
const SHORT_MOVES = 'e8d7';
const BAD_FEN = 'not-a-fen';
const BAD_MOVES = 'a1a8';

let nextId = 0;
function cmd(payload: RoomCommand['payload'], ts = 1): RoomCommand {
  nextId += 1;
  return { id: String(nextId), ts, payload };
}

function reduceAll(state: RoomState, events: readonly unknown[]): RoomState {
  let next = state;
  for (const ev of events) {
    next = ChessModule.reduce(next, ev as never);
  }
  return next;
}

function startValid(state: RoomState, identity = HOST): RoomState {
  const res = ChessModule.handle(
    state,
    cmd(
      StartChessPuzzlePlay({
        puzzleId: 'puzzle-1',
        fen: VALID_FEN,
        moves: VALID_MOVES,
      })
    ),
    identity
  );
  if (!res.ok) throw new Error(`start failed: ${JSON.stringify(res.error)}`);
  return reduceAll(state, res.events);
}

describe('chess puzzle play FSM — Start', () => {
  test('valid multi-move payload transitions to solving with host captured', () => {
    const state = startValid(ChessModule.initialState());
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
    expect(ChessPuzzlePlayAttr.puzzleId.from(state)).toBe('puzzle-1');
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(ChessPuzzlePlayAttr.layoutKey.from(state)).toBe(0);
    expect(ChessPuzzlePlayAttr.orientation.from(state)).toBe('white');
    const display = ChessPuzzlePlayAttr.displayFen.from(state);
    expect(display).not.toBeNull();
    expect((display ?? '').split(/\s+/)[1]).toBe('w');
  });

  test('valid one-token payload transitions straight to solved', () => {
    let state = ChessModule.initialState();
    const res = ChessModule.handle(
      state,
      cmd(
        StartChessPuzzlePlay({
          puzzleId: 'puzzle-short',
          fen: VALID_FEN,
          moves: SHORT_MOVES,
        })
      ),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(ChessPuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(1);
  });

  test('bad FEN transitions to invalid but still captures host', () => {
    let state = ChessModule.initialState();
    const res = ChessModule.handle(
      state,
      cmd(
        StartChessPuzzlePlay({
          puzzleId: 'puzzle-bad',
          fen: BAD_FEN,
          moves: VALID_MOVES,
        })
      ),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.invalid
    );
    expect(ChessPuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBeNull();
  });

  test('illegal opening move transitions to invalid', () => {
    let state = ChessModule.initialState();
    const res = ChessModule.handle(
      state,
      cmd(
        StartChessPuzzlePlay({
          puzzleId: 'puzzle-bad-moves',
          fen: VALID_FEN,
          moves: BAD_MOVES,
        })
      ),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.invalid
    );
  });

  test('Start while session already running rejects with conflict', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(
      state,
      cmd(
        StartChessPuzzlePlay({
          puzzleId: 'puzzle-2',
          fen: VALID_FEN,
          moves: VALID_MOVES,
        })
      ),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });
});

describe('chess puzzle play FSM — Submit', () => {
  test('correct move from host advances index past opponent reply', () => {
    let state = startValid(ChessModule.initialState());
    const before = ChessPuzzlePlayAttr.displayFen.from(state);
    const res = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    const after = ChessPuzzlePlayAttr.displayFen.from(state);
    expect(after).not.toBe(before);
    expect(after).not.toBeNull();
    expect((after ?? '').split(/\s+/)[1]).toBe('w');
  });

  test('final correct move transitions to solved', () => {
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const r2 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'f2e3' })),
      HOST
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    state = reduceAll(state, r2.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(4);
  });

  test('wrong move applies the move, flips to wrong, captures previous fen', () => {
    let state = startValid(ChessModule.initialState());
    const before = ChessPuzzlePlayAttr.layoutKey.from(state);
    const beforeFen = ChessPuzzlePlayAttr.displayFen.from(state);
    const res = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.wrong
    );
    expect(ChessPuzzlePlayAttr.layoutKey.from(state)).toBe(before + 1);
    // Board now reflects the wrong move so the player can see what they did.
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).not.toBe(beforeFen);
    // Pre-move fen is captured so Retry can revert just that ply.
    expect(ChessPuzzlePlayAttr.previousDisplayFen.from(state)).toBe(beforeFen);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(ChessPuzzlePlayAttr.wrongFromSquare.from(state)).toBe('h1');
    expect(ChessPuzzlePlayAttr.wrongToSquare.from(state)).toBe('h2');
  });

  test('second submit while already wrong is rejected as conflict', () => {
    let state = startValid(ChessModule.initialState());
    const wrong1 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    if (!wrong1.ok) throw new Error('first wrong failed');
    state = reduceAll(state, wrong1.events);
    const wrong2 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(wrong2.ok).toBe(false);
    if (wrong2.ok) return;
    expect(wrong2.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });

  test('illegal wrong move is rejected as invalidCommand without state change', () => {
    const state = startValid(ChessModule.initialState());
    const beforeFen = ChessPuzzlePlayAttr.displayFen.from(state);
    // a1 is empty so a1a2 is not a legal move from the post-opening position.
    const res = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'a1a2' })),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.invalidCommand);
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBe(beforeFen);
  });

  test('wrong then retry then correct returns to solving and advances', () => {
    let state = startValid(ChessModule.initialState());
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong submit failed');
    state = reduceAll(state, wrong.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.wrong
    );
    const reset = ChessModule.handle(
      state,
      cmd(ResetChessPuzzlePlay({})),
      HOST
    );
    if (!reset.ok) throw new Error('retry failed');
    state = reduceAll(state, reset.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    const correct = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(correct.ok).toBe(true);
    if (!correct.ok) return;
    state = reduceAll(state, correct.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);
  });

  test('non-host move is rejected as unauthorized', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      GUEST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });

  test('move from solved is rejected as conflict', () => {
    let state = ChessModule.initialState();
    const start = ChessModule.handle(
      state,
      cmd(
        StartChessPuzzlePlay({
          puzzleId: 'short',
          fen: VALID_FEN,
          moves: SHORT_MOVES,
        })
      ),
      HOST
    );
    if (!start.ok) throw new Error('start failed');
    state = reduceAll(state, start.events);
    const res = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });

  test('move from idle is rejected as unauthorized (no host yet)', () => {
    const state = ChessModule.initialState();
    const res = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });
});

describe('chess puzzle play FSM — Hint', () => {
  test('RequestHint sets expected squares and bumps layoutKey', () => {
    let state = startValid(ChessModule.initialState());
    const beforeLk = ChessPuzzlePlayAttr.layoutKey.from(state);
    const res = ChessModule.handle(
      state,
      cmd(RequestChessPuzzleHint({})),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(ChessPuzzlePlayAttr.expectedFromSquare.from(state)).toBe('e1');
    expect(ChessPuzzlePlayAttr.expectedToSquare.from(state)).toBe('f2');
    expect(ChessPuzzlePlayAttr.layoutKey.from(state)).toBe(beforeLk + 1);
  });

  test('Reset clears wrong and hint squares', () => {
    let state = startValid(ChessModule.initialState());
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong failed');
    state = reduceAll(state, wrong.events);
    const reset = ChessModule.handle(
      state,
      cmd(ResetChessPuzzlePlay({})),
      HOST
    );
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    state = reduceAll(state, reset.events);
    expect(ChessPuzzlePlayAttr.wrongFromSquare.from(state)).toBeNull();
    expect(ChessPuzzlePlayAttr.wrongToSquare.from(state)).toBeNull();
    expect(ChessPuzzlePlayAttr.expectedFromSquare.from(state)).toBeNull();
    expect(ChessPuzzlePlayAttr.expectedToSquare.from(state)).toBeNull();
  });
});

describe('chess puzzle play FSM — Reset', () => {
  test('retry from wrong undoes only the wrong move (keeps solveIdx)', () => {
    let state = startValid(ChessModule.initialState());
    const correct = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!correct.ok) throw new Error('first correct failed');
    state = reduceAll(state, correct.events);
    const fenAfterFirstCorrect = ChessPuzzlePlayAttr.displayFen.from(state);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'f2f3' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong submit failed');
    state = reduceAll(state, wrong.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.wrong
    );
    const reset = ChessModule.handle(
      state,
      cmd(ResetChessPuzzlePlay({})),
      HOST
    );
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    state = reduceAll(state, reset.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBe(
      fenAfterFirstCorrect
    );
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    expect(ChessPuzzlePlayAttr.previousDisplayFen.from(state)).toBeNull();
  });

  test('host reset returns to post-opening state and bumps layoutKey', () => {
    let state = startValid(ChessModule.initialState());
    const startedFen = ChessPuzzlePlayAttr.displayFen.from(state);
    const startedLk = ChessPuzzlePlayAttr.layoutKey.from(state);
    const submit = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!submit.ok) throw new Error('submit failed');
    state = reduceAll(state, submit.events);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);

    const reset = ChessModule.handle(
      state,
      cmd(ResetChessPuzzlePlay({})),
      HOST
    );
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    state = reduceAll(state, reset.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBe(startedFen);
    expect(ChessPuzzlePlayAttr.layoutKey.from(state)).toBeGreaterThan(
      startedLk
    );
    expect(ChessPuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
  });

  test('non-host reset is unauthorized', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(ResetChessPuzzlePlay({})), GUEST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });

  test('reset while idle is unauthorized (no host yet)', () => {
    const res = ChessModule.handle(
      ChessModule.initialState(),
      cmd(ResetChessPuzzlePlay({})),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });
});

describe('chess puzzle play FSM — Clear', () => {
  test('host clear resets all attrs to defaults', () => {
    let state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(ClearChessPuzzlePlay({})), HOST);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.idle
    );
    expect(ChessPuzzlePlayAttr.puzzleId.from(state)).toBeNull();
    expect(ChessPuzzlePlayAttr.hostIdentity.from(state)).toBeNull();
    expect(ChessPuzzlePlayAttr.fen.from(state)).toBe('');
    expect(ChessPuzzlePlayAttr.moves.from(state)).toBe('');
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBeNull();
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(0);
    expect(ChessPuzzlePlayAttr.layoutKey.from(state)).toBe(0);
    expect(ChessPuzzlePlayAttr.orientation.from(state)).toBe('white');
  });

  test('clear with no host succeeds (no-op)', () => {
    const state = ChessModule.initialState();
    const res = ChessModule.handle(state, cmd(ClearChessPuzzlePlay({})), GUEST);
    expect(res.ok).toBe(true);
  });

  test('non-host clear during running session is unauthorized', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(ClearChessPuzzlePlay({})), GUEST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });

  test('start, clear, start again succeeds with possibly different host', () => {
    let state = startValid(ChessModule.initialState());
    const c = ChessModule.handle(state, cmd(ClearChessPuzzlePlay({})), HOST);
    if (!c.ok) throw new Error('clear failed');
    state = reduceAll(state, c.events);
    state = startValid(state, GUEST);
    expect(ChessPuzzlePlayAttr.hostIdentity.from(state)).toBe(GUEST);
  });

  test('reclaim transfers host so a new actor can submit moves', () => {
    let state = startValid(ChessModule.initialState());
    const reclaim = ChessModule.handle(
      state,
      cmd(ReclaimChessPuzzlePlay({})),
      GUEST
    );
    expect(reclaim.ok).toBe(true);
    if (!reclaim.ok) return;
    state = reduceAll(state, reclaim.events);
    expect(ChessPuzzlePlayAttr.hostIdentity.from(state)).toBe(GUEST);
    const move = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      GUEST
    );
    expect(move.ok).toBe(true);
  });

  test('reclaim is conflict when caller is already host', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(
      state,
      cmd(ReclaimChessPuzzlePlay({})),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });
});

describe('chess puzzle play FSM — StepBack / StepForward', () => {
  test('step back from solved returns to solving at prior host-to-move', () => {
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const midFen = ChessPuzzlePlayAttr.displayFen.from(state);
    const r2 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'f2e3' })),
      HOST
    );
    if (!r2.ok) throw new Error('second move failed');
    state = reduceAll(state, r2.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solved
    );
    expect(ChessPuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(4);

    const back = ChessModule.handle(
      state,
      cmd(StepBackChessPuzzlePlay({})),
      HOST
    );
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    state = reduceAll(state, back.events);
    expect(ChessPuzzlePlayAttr.status.from(state)).toBe(
      CHESS_PUZZLE_PLAY_STATUS.solving
    );
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBe(midFen);
    expect(ChessPuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(4);
  });

  test('step forward restores furthest without past unattempted', () => {
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const afterFirst = ChessPuzzlePlayAttr.displayFen.from(state);

    const back = ChessModule.handle(
      state,
      cmd(StepBackChessPuzzlePlay({})),
      HOST
    );
    if (!back.ok) throw new Error('step back failed');
    state = reduceAll(state, back.events);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(1);

    const forward = ChessModule.handle(
      state,
      cmd(StepForwardChessPuzzlePlay({})),
      HOST
    );
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    state = reduceAll(state, forward.events);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBe(afterFirst);
  });

  test('step back at start is conflict', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(
      state,
      cmd(StepBackChessPuzzlePlay({})),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });

  test('seek jumps to any reached ply', () => {
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitChessPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const afterFirst = ChessPuzzlePlayAttr.displayFen.from(state);

    const seek = ChessModule.handle(
      state,
      cmd(SeekChessPuzzlePlay({ solveIdx: 1 })),
      HOST
    );
    expect(seek.ok).toBe(true);
    if (!seek.ok) return;
    state = reduceAll(state, seek.events);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(ChessPuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(3);

    const seekBack = ChessModule.handle(
      state,
      cmd(SeekChessPuzzlePlay({ solveIdx: 3 })),
      HOST
    );
    expect(seekBack.ok).toBe(true);
    if (!seekBack.ok) return;
    state = reduceAll(state, seekBack.events);
    expect(ChessPuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    expect(ChessPuzzlePlayAttr.displayFen.from(state)).toBe(afterFirst);
  });
});
