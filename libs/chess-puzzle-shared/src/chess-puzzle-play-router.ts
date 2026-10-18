import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared/play-attr';
import {
  ClearPuzzlePlay,
  ClearPuzzleRecommendation,
  PuzzleHostReclaimed,
  PuzzlePlayCleared,
  PuzzlePlayMoveAccepted,
  PuzzlePlayMoveRejected,
  PuzzlePlayResetEvt,
  PuzzlePlayStarted,
  PuzzlePlayStepped,
  puzzlePlayCmdNs,
  ReclaimPuzzlePlay,
  RecommendPuzzleMove,
  RequestPuzzleHint,
  ResetPuzzlePlay,
  RevealPuzzleSolution,
  SeekPuzzlePlay,
  ShowPuzzleSolution,
  SkipPuzzlePlay,
  StartPuzzlePlay,
  StepBackPuzzlePlay,
  StepForwardPuzzlePlay,
  SubmitPuzzleMove,
} from '@libs/game-puzzle-shared/play-messages';
import {
  lineLength,
  nextForwardSolveIdx,
  prevSolveIdx,
  resolveSeekSolveIdx,
} from '@libs/game-puzzle-shared/step';
import type { GameCommandContext } from '@libs/spaces-shared/game';
import { applyUci } from '@pkgs/chess-rules-shared/moves';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type {
  HandleResult,
  RoomError,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { setupPuzzleStart, tokenize, uciToSquares } from './chess-puzzle-fsm';
import type { PuzzleMoveAccepted } from './chess-puzzle-move-judge';
import { judgePuzzleMove } from './chess-puzzle-move-judge';
import {
  handleRequestHint,
  handleRevealSolution,
} from './chess-puzzle-play-hint-handlers';
import {
  handleClearRecommendation,
  handleRecommend,
} from './chess-puzzle-play-recommendation-handlers';
import {
  handleShowSolution,
  handleSkip,
} from './chess-puzzle-play-terminal-handlers';
import { fenAtSolveIdx } from './chess-puzzle-step';

function reject(error: RoomError): HandleResult {
  return { ok: false, error };
}

function unauthorized(reason: string): HandleResult {
  return reject({ type: ROOM_ERROR_TYPE.unauthorized, reason });
}

function conflict(reason: string): HandleResult {
  return reject({ type: ROOM_ERROR_TYPE.conflict, reason });
}

function internal(reason: string): HandleResult {
  return reject({ type: ROOM_ERROR_TYPE.internal, reason });
}

function isHostOf(state: RoomState, identity: string): boolean {
  const host = PuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

/** Payload of an accepted solver move: its own ply plus any opponent reply. */
function acceptedMovePayload(args: {
  accepted: PuzzleMoveAccepted;
  idx: number;
  ts: number;
}):
  | {
      uci: string;
      san: string;
      displayFen: string;
      solveIdx: number;
      status: PuzzlePlayStatus;
      endedAtMs: number | null;
      moves: string;
    }
  | { error: HandleResult } {
  const { accepted, idx, ts } = args;
  const base = {
    uci: accepted.uci,
    san: accepted.san,
    moves: accepted.line.join(' '),
  };
  const replyIdx = idx + 1;
  const reply = accepted.line[replyIdx];
  if (accepted.ends || reply === undefined) {
    return {
      ...base,
      displayFen: accepted.fen,
      solveIdx: replyIdx,
      status: PUZZLE_PLAY_STATUS.solved,
      endedAtMs: ts,
    };
  }
  const replied = applyUci(accepted.fen, reply);
  if (!replied.ok) {
    return {
      error: internal('opponent reply did not apply to current position'),
    };
  }
  const solveIdx = replyIdx + 1;
  const solved = solveIdx >= accepted.line.length;
  return {
    ...base,
    displayFen: replied.fen,
    solveIdx,
    status: solved ? PUZZLE_PLAY_STATUS.solved : PUZZLE_PLAY_STATUS.solving,
    endedAtMs: solved ? ts : null,
  };
}

function handleSubmitMove(
  state: RoomState,
  ctx: GameCommandContext,
  uci: string
): HandleResult {
  if (!isHostOf(state, ctx.identity)) {
    return unauthorized('only the puzzle host may submit moves');
  }
  const status = PuzzlePlayAttr.status.from(state);
  if (status !== PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot submit move while status is ${status}`);
  }
  const tokens = tokenize(PuzzlePlayAttr.line.from(state));
  const idx = PuzzlePlayAttr.solveIdx.from(state);
  if (idx !== PuzzlePlayAttr.furthestSolveIdx.from(state)) {
    return conflict('return to the current position before submitting a move');
  }
  const fen = PuzzlePlayAttr.displayPosition.from(state);
  if (tokens[idx] === undefined) {
    return internal('no expected move at current solve index');
  }
  if (fen === null) return internal('cannot apply move without a display fen');
  const verdict = judgePuzzleMove({ fen, tokens, idx, uci });
  if (verdict.kind === 'illegal') {
    return reject({
      type: ROOM_ERROR_TYPE.invalidCommand,
      reason: 'illegal move for current position',
    });
  }
  if (verdict.kind === 'wrong') {
    return handleWrongMove(state, verdict.uci, verdict.san);
  }
  const applied = acceptedMovePayload({ accepted: verdict, idx, ts: ctx.ts });
  if ('error' in applied) return applied.error;
  return {
    ok: true,
    events: [PuzzlePlayMoveAccepted(applied)],
  };
}

/**
 * A legal but wrong move is never applied to the reached position: the
 * display FEN keeps the position the solver moved from, the board shows the
 * piece on its wrong square, flagged red, and the attempt turns `wrong` (§5).
 */
function handleWrongMove(
  state: RoomState,
  uci: string,
  san: string
): HandleResult {
  const squares = uciToSquares(uci);
  if (squares === null) {
    return reject({
      type: ROOM_ERROR_TYPE.invalidCommand,
      reason: 'malformed uci for rejected move',
    });
  }
  return {
    ok: true,
    events: [
      PuzzlePlayMoveRejected({
        uci,
        san,
        layoutKey: PuzzlePlayAttr.layoutKey.from(state) + 1,
        wrongToSquare: squares.to,
      }),
    ],
  };
}

function handleStart(
  state: RoomState,
  ctx: GameCommandContext,
  payload: { puzzleId: string; fen: string; moves: string }
): HandleResult {
  if (PuzzlePlayAttr.hostIdentity.from(state) !== null) {
    return conflict('puzzle play already started; clear first');
  }
  const { puzzleId, fen, moves } = payload;
  const setup = setupPuzzleStart(fen, moves);
  if (setup.kind === 'invalid') {
    return {
      ok: true,
      events: [
        PuzzlePlayStarted({
          puzzleId,
          fen,
          moves,
          hostIdentity: ctx.identity,
          displayFen: null,
          orientation: 'white',
          status: PUZZLE_PLAY_STATUS.invalid,
          solveIdx: 0,
          startedAtMs: ctx.ts,
          attemptId: ctx.commandId,
        }),
      ],
    };
  }
  return {
    ok: true,
    events: [
      PuzzlePlayStarted({
        puzzleId,
        fen,
        moves,
        hostIdentity: ctx.identity,
        displayFen: setup.displayFen,
        orientation: setup.orientation,
        status: setup.status,
        solveIdx: 1,
        startedAtMs: ctx.ts,
        attemptId: ctx.commandId,
      }),
    ],
  };
}

function handleReset(state: RoomState, identity: string): HandleResult {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may reset');
  }
  const status = PuzzlePlayAttr.status.from(state);
  if (status === PUZZLE_PLAY_STATUS.idle) {
    return conflict('no puzzle in play to reset');
  }
  const layoutKey = PuzzlePlayAttr.layoutKey.from(state) + 1;

  // Wrong-move retry: the wrong move was never applied, so keep the position
  // and `solveIdx`; the player picks back up at the same expected move.
  if (status === PUZZLE_PLAY_STATUS.wrong) {
    return {
      ok: true,
      events: [
        PuzzlePlayResetEvt({
          displayFen: PuzzlePlayAttr.displayPosition.from(state),
          solveIdx: PuzzlePlayAttr.solveIdx.from(state),
          furthestSolveIdx: PuzzlePlayAttr.furthestSolveIdx.from(state),
          status: PUZZLE_PLAY_STATUS.solving,
          layoutKey,
        }),
      ],
    };
  }

  const fen = PuzzlePlayAttr.position.from(state);
  const moves = PuzzlePlayAttr.line.from(state);
  const setup = setupPuzzleStart(fen, moves);
  if (setup.kind === 'invalid') {
    return {
      ok: true,
      events: [
        PuzzlePlayResetEvt({
          displayFen: null,
          solveIdx: 0,
          furthestSolveIdx: 0,
          status: PUZZLE_PLAY_STATUS.invalid,
          layoutKey,
        }),
      ],
    };
  }
  return {
    ok: true,
    events: [
      PuzzlePlayResetEvt({
        displayFen: setup.displayFen,
        solveIdx: 1,
        furthestSolveIdx: 1,
        status: setup.status,
        layoutKey,
      }),
    ],
  };
}

function assertCanSeekLine(
  state: RoomState,
  identity: string
): HandleResult | null {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may step the puzzle line');
  }
  const status = PuzzlePlayAttr.status.from(state);
  if (
    status !== PUZZLE_PLAY_STATUS.solving &&
    status !== PUZZLE_PLAY_STATUS.solved &&
    status !== PUZZLE_PLAY_STATUS.revealed
  ) {
    return conflict(`cannot step while status is ${status}`);
  }
  return null;
}

function emitSeekToSolveIdx(state: RoomState, nextIdx: number): HandleResult {
  const fen = PuzzlePlayAttr.position.from(state);
  const moves = PuzzlePlayAttr.line.from(state);
  const displayFen = fenAtSolveIdx({ fen, moves, solveIdx: nextIdx });
  if (displayFen === null) {
    return internal('could not rebuild fen for stepped solve index');
  }
  return {
    ok: true,
    events: [
      PuzzlePlayStepped({
        displayFen,
        solveIdx: nextIdx,
        // Viewing an earlier position never reopens a finished puzzle.
        status: PuzzlePlayAttr.status.from(state),
        layoutKey: PuzzlePlayAttr.layoutKey.from(state) + 1,
      }),
    ],
  };
}

function handleStepSeek(
  state: RoomState,
  identity: string,
  direction: 'back' | 'forward'
): HandleResult {
  const denied = assertCanSeekLine(state, identity);
  if (denied !== null) return denied;
  const solveIdx = PuzzlePlayAttr.solveIdx.from(state);
  const furthest = PuzzlePlayAttr.furthestSolveIdx.from(state);
  const tokensLength = lineLength(PuzzlePlayAttr.line.from(state));
  const nextIdx =
    direction === 'back'
      ? prevSolveIdx(solveIdx)
      : nextForwardSolveIdx({
          solveIdx,
          furthestSolveIdx: furthest,
          tokensLength,
        });
  if (nextIdx === null) {
    return conflict(
      direction === 'back' ? 'already at puzzle start' : 'already at furthest'
    );
  }
  return emitSeekToSolveIdx(state, nextIdx);
}

function handleSeek(
  state: RoomState,
  identity: string,
  targetSolveIdx: number
): HandleResult {
  const denied = assertCanSeekLine(state, identity);
  if (denied !== null) return denied;
  const nextIdx = resolveSeekSolveIdx({
    solveIdx: PuzzlePlayAttr.solveIdx.from(state),
    furthestSolveIdx: PuzzlePlayAttr.furthestSolveIdx.from(state),
    targetSolveIdx,
  });
  if (nextIdx === null) {
    return conflict('seek target is out of range or already current');
  }
  return emitSeekToSolveIdx(state, nextIdx);
}

function handleClear(state: RoomState, identity: string): HandleResult {
  const host = PuzzlePlayAttr.hostIdentity.from(state);
  if (host !== null && host !== identity) {
    return unauthorized('only the puzzle host may clear');
  }
  return { ok: true, events: [PuzzlePlayCleared({})] };
}

function handleReclaim(state: RoomState, identity: string): HandleResult {
  const status = PuzzlePlayAttr.status.from(state);
  if (status === PUZZLE_PLAY_STATUS.idle) {
    return conflict('no puzzle in play to reclaim');
  }
  const host = PuzzlePlayAttr.hostIdentity.from(state);
  if (host === identity) {
    return conflict('caller is already the puzzle host');
  }
  return {
    ok: true,
    events: [PuzzleHostReclaimed({ hostIdentity: identity })],
  };
}

export const chessPuzzlePlayCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(puzzlePlayCmdNs)
  .on(StartPuzzlePlay, (state, ctx, c) => handleStart(state, ctx, c.payload))
  .on(SubmitPuzzleMove, (state, ctx, c) =>
    handleSubmitMove(state, ctx, c.payload.uci)
  )
  .on(ResetPuzzlePlay, (state, ctx) => handleReset(state, ctx.identity))
  .on(StepBackPuzzlePlay, (state, ctx) =>
    handleStepSeek(state, ctx.identity, 'back')
  )
  .on(StepForwardPuzzlePlay, (state, ctx) =>
    handleStepSeek(state, ctx.identity, 'forward')
  )
  .on(SeekPuzzlePlay, (state, ctx, c) =>
    handleSeek(state, ctx.identity, c.payload.solveIdx)
  )
  .on(ClearPuzzlePlay, (state, ctx) => handleClear(state, ctx.identity))
  .on(RequestPuzzleHint, (state, ctx) => handleRequestHint(state, ctx.identity))
  .on(RevealPuzzleSolution, (state, ctx) =>
    handleRevealSolution(state, ctx.identity)
  )
  .on(ReclaimPuzzlePlay, (state, ctx) => handleReclaim(state, ctx.identity))
  .on(SkipPuzzlePlay, (state, ctx) => handleSkip(state, ctx))
  .on(ShowPuzzleSolution, (state, ctx) => handleShowSolution(state, ctx))
  .on(RecommendPuzzleMove, (state, ctx, c) =>
    handleRecommend(state, ctx.identity, c.payload)
  )
  .on(ClearPuzzleRecommendation, (state, ctx) =>
    handleClearRecommendation(state, ctx.identity)
  );
