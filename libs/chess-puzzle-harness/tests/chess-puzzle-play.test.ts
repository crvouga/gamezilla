import { describe, expect, test } from 'bun:test';
import { createChessModule } from '@libs/chess-puzzle-harness/chess-module';
import { CHESS_PUZZLE_GAME } from '@libs/chess-puzzle-shared/chess-puzzles';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared/play-attr';
import {
  ClearPuzzlePlay,
  ClearPuzzleRecommendation,
  ReclaimPuzzlePlay,
  RecommendPuzzleMove,
  RequestPuzzleHint,
  ResetPuzzlePlay,
  RevealPuzzleSolution,
  SeekPuzzlePlay,
  SkipPuzzlePlay,
  StartPuzzlePlay,
  StepBackPuzzlePlay,
  StepForwardPuzzlePlay,
  SubmitPuzzleMove,
} from '@libs/game-puzzle-shared/play-messages';
import { PUZZLE_MAX_RECOMMENDATIONS } from '@libs/game-puzzle-shared/recommendations';
import { projectBoardPosition } from '@libs/game-puzzle-shared/solve-projection';
import type { RoomCommand, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';

const ChessModule = createChessModule(() => 0);

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
      StartPuzzlePlay({
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
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solving);
    expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
    expect(PuzzlePlayAttr.puzzleId.from(state)).toBe('puzzle-1');
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(PuzzlePlayAttr.layoutKey.from(state)).toBe(0);
    expect(PuzzlePlayAttr.solverSide.from(state)).toBe('white');
    const display = PuzzlePlayAttr.displayPosition.from(state);
    expect(display).not.toBeNull();
    expect((display ?? '').split(/\s+/)[1]).toBe('w');
  });

  test('valid one-token payload transitions straight to solved', () => {
    let state = ChessModule.initialState();
    const res = ChessModule.handle(
      state,
      cmd(
        StartPuzzlePlay({
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
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
    expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(1);
  });

  test('bad FEN transitions to invalid but still captures host', () => {
    let state = ChessModule.initialState();
    const res = ChessModule.handle(
      state,
      cmd(
        StartPuzzlePlay({
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
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.invalid);
    expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBeNull();
  });

  test('illegal opening move transitions to invalid', () => {
    let state = ChessModule.initialState();
    const res = ChessModule.handle(
      state,
      cmd(
        StartPuzzlePlay({
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
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.invalid);
  });

  test('Start while session already running rejects with conflict', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(
      state,
      cmd(
        StartPuzzlePlay({
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
    const before = PuzzlePlayAttr.displayPosition.from(state);
    const res = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const accepted = res.events[0] as {
      payload: { san?: string; uci?: string };
    };
    expect(accepted.payload.uci).toBe('e1f2');
    expect(accepted.payload.san).toBe('Kf2');
    state = reduceAll(state, res.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solving);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    const after = PuzzlePlayAttr.displayPosition.from(state);
    expect(after).not.toBe(before);
    expect(after).not.toBeNull();
    expect((after ?? '').split(/\s+/)[1]).toBe('w');
  });

  test('final correct move transitions to solved', () => {
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const r2 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'f2e3' })),
      HOST
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    state = reduceAll(state, r2.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(4);
  });

  test('wrong move is not applied to the reached position and flips to wrong', () => {
    let state = startValid(ChessModule.initialState());
    const before = PuzzlePlayAttr.layoutKey.from(state);
    const beforeFen = PuzzlePlayAttr.displayPosition.from(state);
    const res = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const rejected = res.events[0] as {
      payload: { san?: string; uci?: string };
    };
    expect(rejected.payload.uci).toBe('h1h2');
    expect(rejected.payload.san).toBe('Rh2');
    state = reduceAll(state, res.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.wrong);
    expect(PuzzlePlayAttr.layoutKey.from(state)).toBe(before + 1);
    // §5: the reached position is kept; the board paints the wrong move
    // over it from `wrongAction` (`projectBoardPosition`).
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(beforeFen);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(PuzzlePlayAttr.wrongAction.from(state)).toBe('h1h2');
    expect(PuzzlePlayAttr.wrongMark.from(state)).toBe('h2');
  });

  test('second submit while already wrong is rejected as conflict', () => {
    let state = startValid(ChessModule.initialState());
    const wrong1 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    if (!wrong1.ok) throw new Error('first wrong failed');
    state = reduceAll(state, wrong1.events);
    const wrong2 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(wrong2.ok).toBe(false);
    if (wrong2.ok) return;
    expect(wrong2.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });

  test('illegal wrong move is rejected as invalidCommand without state change', () => {
    const state = startValid(ChessModule.initialState());
    const beforeFen = PuzzlePlayAttr.displayPosition.from(state);
    // a1 is empty so a1a2 is not a legal move from the post-opening position.
    const res = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'a1a2' })),
      HOST
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.invalidCommand);
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(beforeFen);
  });

  test('the board keeps a wrong move on its square until the retry', () => {
    const boardOf = (state: RoomState): string | null =>
      projectBoardPosition(CHESS_PUZZLE_GAME, {
        status: PuzzlePlayAttr.status.from(state),
        position: PuzzlePlayAttr.displayPosition.from(state),
        wrongAction: PuzzlePlayAttr.wrongAction.from(state),
      });
    let state = startValid(ChessModule.initialState());
    const reached = PuzzlePlayAttr.displayPosition.from(state);
    expect(boardOf(state)).toBe(reached);
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong submit failed');
    state = reduceAll(state, wrong.events);
    // The rook stands on h2, where it was dropped; h1 is empty.
    expect(boardOf(state)).toBe('8/3k4/8/8/8/8/4P2R/4K3 b - - 2 2');
    const reset = ChessModule.handle(state, cmd(ResetPuzzlePlay({})), HOST);
    if (!reset.ok) throw new Error('retry failed');
    state = reduceAll(state, reset.events);
    expect(boardOf(state)).toBe(reached);
  });

  test('wrong then retry then correct returns to solving and advances', () => {
    let state = startValid(ChessModule.initialState());
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong submit failed');
    state = reduceAll(state, wrong.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.wrong);
    const reset = ChessModule.handle(state, cmd(ResetPuzzlePlay({})), HOST);
    if (!reset.ok) throw new Error('retry failed');
    state = reduceAll(state, reset.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solving);
    const correct = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    expect(correct.ok).toBe(true);
    if (!correct.ok) return;
    state = reduceAll(state, correct.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solving);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);
  });

  test('non-host move is rejected as unauthorized', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
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
        StartPuzzlePlay({
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
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
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
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
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
    const beforeLk = PuzzlePlayAttr.layoutKey.from(state);
    const res = ChessModule.handle(state, cmd(RequestPuzzleHint({})), HOST);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(PuzzlePlayAttr.hintFrom.from(state)).toBe('e1');
    expect(PuzzlePlayAttr.hintTo.from(state)).toBe('f2');
    expect(PuzzlePlayAttr.layoutKey.from(state)).toBe(beforeLk + 1);
    expect(PuzzlePlayAttr.solutionRevealed.from(state)).toBe(0);
  });

  test('RevealSolution sets solutionRevealed after hint', () => {
    let state = startValid(ChessModule.initialState());
    const hint = ChessModule.handle(state, cmd(RequestPuzzleHint({})), HOST);
    if (!hint.ok) throw new Error('hint failed');
    state = reduceAll(state, hint.events);
    const reveal = ChessModule.handle(
      state,
      cmd(RevealPuzzleSolution({})),
      HOST
    );
    expect(reveal.ok).toBe(true);
    if (!reveal.ok) return;
    state = reduceAll(state, reveal.events);
    expect(PuzzlePlayAttr.solutionRevealed.from(state)).toBe(1);
  });

  test('Reset clears wrong and hint squares', () => {
    let state = startValid(ChessModule.initialState());
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'h1h2' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong failed');
    state = reduceAll(state, wrong.events);
    const reset = ChessModule.handle(state, cmd(ResetPuzzlePlay({})), HOST);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    state = reduceAll(state, reset.events);
    expect(PuzzlePlayAttr.wrongAction.from(state)).toBeNull();
    expect(PuzzlePlayAttr.wrongMark.from(state)).toBeNull();
    expect(PuzzlePlayAttr.hintFrom.from(state)).toBeNull();
    expect(PuzzlePlayAttr.hintTo.from(state)).toBeNull();
  });
});

describe('chess puzzle play FSM — Reset', () => {
  test('retry from wrong undoes only the wrong move (keeps solveIdx)', () => {
    let state = startValid(ChessModule.initialState());
    const correct = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!correct.ok) throw new Error('first correct failed');
    state = reduceAll(state, correct.events);
    const fenAfterFirstCorrect = PuzzlePlayAttr.displayPosition.from(state);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'f2f3' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong submit failed');
    state = reduceAll(state, wrong.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.wrong);
    const reset = ChessModule.handle(state, cmd(ResetPuzzlePlay({})), HOST);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    state = reduceAll(state, reset.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solving);
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(
      fenAfterFirstCorrect
    );
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);
  });

  test('host reset returns to post-opening state and bumps layoutKey', () => {
    let state = startValid(ChessModule.initialState());
    const startedFen = PuzzlePlayAttr.displayPosition.from(state);
    const startedLk = PuzzlePlayAttr.layoutKey.from(state);
    const submit = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!submit.ok) throw new Error('submit failed');
    state = reduceAll(state, submit.events);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);

    const reset = ChessModule.handle(state, cmd(ResetPuzzlePlay({})), HOST);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    state = reduceAll(state, reset.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solving);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(startedFen);
    expect(PuzzlePlayAttr.layoutKey.from(state)).toBeGreaterThan(startedLk);
    expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(HOST);
  });

  test('non-host reset is unauthorized', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(ResetPuzzlePlay({})), GUEST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });

  test('reset while idle is unauthorized (no host yet)', () => {
    const res = ChessModule.handle(
      ChessModule.initialState(),
      cmd(ResetPuzzlePlay({})),
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
    const res = ChessModule.handle(state, cmd(ClearPuzzlePlay({})), HOST);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.idle);
    expect(PuzzlePlayAttr.puzzleId.from(state)).toBeNull();
    expect(PuzzlePlayAttr.hostIdentity.from(state)).toBeNull();
    expect(PuzzlePlayAttr.position.from(state)).toBe('');
    expect(PuzzlePlayAttr.line.from(state)).toBe('');
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBeNull();
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(0);
    expect(PuzzlePlayAttr.layoutKey.from(state)).toBe(0);
    expect(PuzzlePlayAttr.solverSide.from(state)).toBe('white');
  });

  test('clear with no host succeeds (no-op)', () => {
    const state = ChessModule.initialState();
    const res = ChessModule.handle(state, cmd(ClearPuzzlePlay({})), GUEST);
    expect(res.ok).toBe(true);
  });

  test('non-host clear during running session is unauthorized', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(ClearPuzzlePlay({})), GUEST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });

  test('start, clear, start again succeeds with possibly different host', () => {
    let state = startValid(ChessModule.initialState());
    const c = ChessModule.handle(state, cmd(ClearPuzzlePlay({})), HOST);
    if (!c.ok) throw new Error('clear failed');
    state = reduceAll(state, c.events);
    state = startValid(state, GUEST);
    expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(GUEST);
  });

  test('reclaim transfers host so a new actor can submit moves', () => {
    let state = startValid(ChessModule.initialState());
    const reclaim = ChessModule.handle(
      state,
      cmd(ReclaimPuzzlePlay({})),
      GUEST
    );
    expect(reclaim.ok).toBe(true);
    if (!reclaim.ok) return;
    state = reduceAll(state, reclaim.events);
    expect(PuzzlePlayAttr.hostIdentity.from(state)).toBe(GUEST);
    const move = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      GUEST
    );
    expect(move.ok).toBe(true);
  });

  test('reclaim is conflict when caller is already host', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(ReclaimPuzzlePlay({})), HOST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });
});

describe('chess puzzle play FSM — StepBack / StepForward', () => {
  test('step back from solved rewinds one ply and retains completion', () => {
    // regression: puzzle-solved-review-resumes
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const midFen = PuzzlePlayAttr.displayPosition.from(state);
    const r2 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'f2e3' })),
      HOST
    );
    if (!r2.ok) throw new Error('second move failed');
    state = reduceAll(state, r2.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
    expect(PuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(4);

    const back = ChessModule.handle(state, cmd(StepBackPuzzlePlay({})), HOST);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    state = reduceAll(state, back.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(midFen);
    expect(PuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(4);
  });

  test('step back/forward walks every ply including opponent replies', () => {
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const afterFirst = PuzzlePlayAttr.displayPosition.from(state);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);

    const backToPlayer = ChessModule.handle(
      state,
      cmd(StepBackPuzzlePlay({})),
      HOST
    );
    if (!backToPlayer.ok) throw new Error('step back to player ply failed');
    state = reduceAll(state, backToPlayer.events);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(2);

    const backToOpening = ChessModule.handle(
      state,
      cmd(StepBackPuzzlePlay({})),
      HOST
    );
    if (!backToOpening.ok) throw new Error('step back to opening failed');
    state = reduceAll(state, backToOpening.events);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(1);

    const forwardToPlayer = ChessModule.handle(
      state,
      cmd(StepForwardPuzzlePlay({})),
      HOST
    );
    expect(forwardToPlayer.ok).toBe(true);
    if (!forwardToPlayer.ok) return;
    state = reduceAll(state, forwardToPlayer.events);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(2);

    const forwardToReply = ChessModule.handle(
      state,
      cmd(StepForwardPuzzlePlay({})),
      HOST
    );
    expect(forwardToReply.ok).toBe(true);
    if (!forwardToReply.ok) return;
    state = reduceAll(state, forwardToReply.events);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(afterFirst);
  });

  test('step back at start is conflict', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(StepBackPuzzlePlay({})), HOST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });

  test('seek jumps to any reached ply', () => {
    let state = startValid(ChessModule.initialState());
    const r1 = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!r1.ok) throw new Error('first move failed');
    state = reduceAll(state, r1.events);
    const afterFirst = PuzzlePlayAttr.displayPosition.from(state);

    const seek = ChessModule.handle(
      state,
      cmd(SeekPuzzlePlay({ solveIdx: 1 })),
      HOST
    );
    expect(seek.ok).toBe(true);
    if (!seek.ok) return;
    state = reduceAll(state, seek.events);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(1);
    expect(PuzzlePlayAttr.furthestSolveIdx.from(state)).toBe(3);

    const seekBack = ChessModule.handle(
      state,
      cmd(SeekPuzzlePlay({ solveIdx: 3 })),
      HOST
    );
    expect(seekBack.ok).toBe(true);
    if (!seekBack.ok) return;
    state = reduceAll(state, seekBack.events);
    expect(PuzzlePlayAttr.solveIdx.from(state)).toBe(3);
    expect(PuzzlePlayAttr.displayPosition.from(state)).toBe(afterFirst);
  });
});

describe('chess puzzle play FSM — clock', () => {
  test('start stamps the server time and solving keeps it running', () => {
    const state = startValid(ChessModule.initialState());
    expect(PuzzlePlayAttr.startedAtMs.from(state)).toBe(1);
    expect(PuzzlePlayAttr.endedAtMs.from(state)).toBeNull();
  });

  test('a wrong move keeps the clock running; retry does not reset it', () => {
    let state = startValid(ChessModule.initialState());
    const wrong = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1d1' })),
      HOST
    );
    if (!wrong.ok) throw new Error('wrong move rejected');
    state = reduceAll(state, wrong.events);
    expect(PuzzlePlayAttr.endedAtMs.from(state)).toBeNull();

    const retry = ChessModule.handle(
      state,
      cmd(ResetPuzzlePlay({}), 500),
      HOST
    );
    if (!retry.ok) throw new Error('retry rejected');
    state = reduceAll(state, retry.events);
    expect(PuzzlePlayAttr.startedAtMs.from(state)).toBe(1);
    expect(PuzzlePlayAttr.endedAtMs.from(state)).toBeNull();
  });

  test('solving the last ply freezes the clock at the commit time', () => {
    let state = startValid(ChessModule.initialState());
    const tokens = ['e1f2', 'f2e3'];
    for (const [index, uci] of tokens.entries()) {
      const res = ChessModule.handle(
        state,
        cmd(SubmitPuzzleMove({ uci }), 10 + index),
        HOST
      );
      if (!res.ok) throw new Error(`move ${uci} rejected`);
      state = reduceAll(state, res.events);
    }
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
    expect(PuzzlePlayAttr.endedAtMs.from(state)).toBe(11);
  });

  test('clear resets both anchors', () => {
    let state = startValid(ChessModule.initialState());
    const cleared = ChessModule.handle(state, cmd(ClearPuzzlePlay({})), HOST);
    if (!cleared.ok) throw new Error('clear rejected');
    state = reduceAll(state, cleared.events);
    expect(PuzzlePlayAttr.startedAtMs.from(state)).toBeNull();
    expect(PuzzlePlayAttr.endedAtMs.from(state)).toBeNull();
  });
});

describe('chess puzzle play FSM — skip', () => {
  test('the host skips a live attempt and it becomes terminal', () => {
    let state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(SkipPuzzlePlay({}), 42), HOST);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.skipped);
    expect(PuzzlePlayAttr.endedAtMs.from(state)).toBe(42);
  });

  test('a guest cannot skip', () => {
    const state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(state, cmd(SkipPuzzlePlay({})), GUEST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.unauthorized);
  });

  test('skipping a solved puzzle is a conflict', () => {
    let state = startValid(ChessModule.initialState());
    for (const uci of ['e1f2', 'f2e3']) {
      const solved = ChessModule.handle(
        state,
        cmd(SubmitPuzzleMove({ uci })),
        HOST
      );
      if (!solved.ok) throw new Error(`move ${uci} rejected`);
      state = reduceAll(state, solved.events);
    }
    expect(PuzzlePlayAttr.status.from(state)).toBe(PUZZLE_PLAY_STATUS.solved);
    const res = ChessModule.handle(state, cmd(SkipPuzzlePlay({})), HOST);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  });
});

describe('chess puzzle play FSM — guest permissions', () => {
  test('a guest is denied every control command and the state is untouched', () => {
    const state = startValid(ChessModule.initialState());
    const before = JSON.stringify(state);
    const commands = [
      RequestPuzzleHint({}),
      RevealPuzzleSolution({}),
      StepBackPuzzlePlay({}),
      StepForwardPuzzlePlay({}),
      SeekPuzzlePlay({ solveIdx: 1 }),
      ResetPuzzlePlay({}),
      ClearPuzzlePlay({}),
      SkipPuzzlePlay({}),
    ];
    for (const payload of commands) {
      const res = ChessModule.handle(state, cmd(payload), GUEST);
      expect(res.ok).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
    }
  });
});

describe('chess puzzle play FSM — spectator recommendations', () => {
  test('a guest may suggest for the live position', () => {
    let state = startValid(ChessModule.initialState());
    const res = ChessModule.handle(
      state,
      cmd(RecommendPuzzleMove({ from: 'e1', to: 'f2' })),
      GUEST
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    state = reduceAll(state, res.events);
    expect(PuzzlePlayAttr.recommendations.from(state)).toEqual({
      [GUEST]: { from: 'e1', to: 'f2', seq: 1 },
    });
  });

  test('suggestions are rejected while not solving, and clearable by their author', () => {
    const idle = ChessModule.initialState();
    const rejected = ChessModule.handle(
      idle,
      cmd(RecommendPuzzleMove({ from: 'e1', to: 'f2' })),
      GUEST
    );
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error.type).toBe(ROOM_ERROR_TYPE.conflict);

    let state = startValid(ChessModule.initialState());
    const add = ChessModule.handle(
      state,
      cmd(RecommendPuzzleMove({ from: 'e1', to: 'f2' })),
      GUEST
    );
    if (!add.ok) throw new Error('suggest rejected');
    state = reduceAll(state, add.events);
    const cleared = ChessModule.handle(
      state,
      cmd(ClearPuzzleRecommendation({})),
      GUEST
    );
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    state = reduceAll(state, cleared.events);
    expect(PuzzlePlayAttr.recommendations.from(state)).toEqual({});
  });

  test('the cap evicts the oldest suggester', () => {
    let state = startValid(ChessModule.initialState());
    for (let i = 0; i < PUZZLE_MAX_RECOMMENDATIONS + 1; i += 1) {
      const res = ChessModule.handle(
        state,
        cmd(RecommendPuzzleMove({ from: 'e1', to: 'f2' })),
        `guest-${i}`
      );
      if (!res.ok) throw new Error('suggest rejected');
      state = reduceAll(state, res.events);
    }
    const map = PuzzlePlayAttr.recommendations.from(state);
    expect(Object.keys(map)).toHaveLength(PUZZLE_MAX_RECOMMENDATIONS);
    expect(map['guest-0']).toBeUndefined();
  });

  test('the host moving on clears every suggestion', () => {
    let state = startValid(ChessModule.initialState());
    const add = ChessModule.handle(
      state,
      cmd(RecommendPuzzleMove({ from: 'e1', to: 'f2' })),
      GUEST
    );
    if (!add.ok) throw new Error('suggest rejected');
    state = reduceAll(state, add.events);

    const move = ChessModule.handle(
      state,
      cmd(SubmitPuzzleMove({ uci: 'e1f2' })),
      HOST
    );
    if (!move.ok) throw new Error('move rejected');
    state = reduceAll(state, move.events);
    expect(PuzzlePlayAttr.recommendations.from(state)).toEqual({});
  });
});
