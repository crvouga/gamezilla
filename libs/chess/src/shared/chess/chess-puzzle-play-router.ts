import type { GameCommandContext } from '@libs/spaces/public/game';
import { applyUci } from '@pkgs/chess-rules/moves';
import { createMessageRouter } from '@pkgs/message';
import {
  type HandleResult,
  ROOM_ERROR_TYPE,
  type RoomError,
  type RoomState,
} from '@pkgs/room';

import { setupPuzzleStart, tokenize, uciToSquares } from './chess-puzzle-fsm';
import {
  judgePuzzleMove,
  type PuzzleMoveAccepted,
} from './chess-puzzle-move-judge';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  type ChessPuzzlePlayStatus,
} from './chess-puzzle-play-attr';
import {
  handleRequestHint,
  handleRevealSolution,
} from './chess-puzzle-play-hint-handlers';
import {
  ChessPuzzleHostReclaimed,
  ChessPuzzlePlayCleared,
  ChessPuzzlePlayMoveAccepted,
  ChessPuzzlePlayMoveRejected,
  ChessPuzzlePlayResetEvt,
  ChessPuzzlePlayStarted,
  ChessPuzzlePlayStepped,
  ClearChessPuzzlePlay,
  ClearChessPuzzleRecommendation,
  chessPuzzlePlayCmdNs,
  ReclaimChessPuzzlePlay,
  RecommendChessPuzzleMove,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  RevealChessPuzzleSolution,
  SeekChessPuzzlePlay,
  ShowChessPuzzleSolution,
  SkipChessPuzzlePlay,
  StartChessPuzzlePlay,
  StepBackChessPuzzlePlay,
  StepForwardChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from './chess-puzzle-play-messages';
import {
  handleClearRecommendation,
  handleRecommend,
} from './chess-puzzle-play-recommendation-handlers';
import {
  handleShowSolution,
  handleSkip,
} from './chess-puzzle-play-terminal-handlers';
import {
  fenAtSolveIdx,
  nextForwardSolveIdx,
  prevSolveIdx,
  puzzleTokensLength,
  resolveSeekSolveIdx,
  statusAtSolveIdx,
} from './chess-puzzle-step';

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
  const host = ChessPuzzlePlayAttr.hostIdentity.from(state);
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
      status: ChessPuzzlePlayStatus;
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
      status: CHESS_PUZZLE_PLAY_STATUS.solved,
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
    status: solved
      ? CHESS_PUZZLE_PLAY_STATUS.solved
      : CHESS_PUZZLE_PLAY_STATUS.solving,
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
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (status !== CHESS_PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot submit move while status is ${status}`);
  }
  const tokens = tokenize(ChessPuzzlePlayAttr.moves.from(state));
  const idx = ChessPuzzlePlayAttr.solveIdx.from(state);
  const fen = ChessPuzzlePlayAttr.displayFen.from(state);
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
    events: [ChessPuzzlePlayMoveAccepted(applied)],
  };
}

/**
 * A legal but wrong move is never applied: the display keeps the position
 * the solver moved from, so the piece returns; the from / to squares are
 * flagged red and the attempt turns `wrong` (§5).
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
      ChessPuzzlePlayMoveRejected({
        uci,
        san,
        layoutKey: ChessPuzzlePlayAttr.layoutKey.from(state) + 1,
        wrongFromSquare: squares.from,
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
  if (ChessPuzzlePlayAttr.hostIdentity.from(state) !== null) {
    return conflict('puzzle play already started; clear first');
  }
  const { puzzleId, fen, moves } = payload;
  const setup = setupPuzzleStart(fen, moves);
  if (setup.kind === 'invalid') {
    return {
      ok: true,
      events: [
        ChessPuzzlePlayStarted({
          puzzleId,
          fen,
          moves,
          hostIdentity: ctx.identity,
          displayFen: null,
          orientation: 'white',
          status: CHESS_PUZZLE_PLAY_STATUS.invalid,
          solveIdx: 0,
          startedAtMs: ctx.ts,
        }),
      ],
    };
  }
  return {
    ok: true,
    events: [
      ChessPuzzlePlayStarted({
        puzzleId,
        fen,
        moves,
        hostIdentity: ctx.identity,
        displayFen: setup.displayFen,
        orientation: setup.orientation,
        status: setup.status,
        solveIdx: 1,
        startedAtMs: ctx.ts,
      }),
    ],
  };
}

function handleReset(state: RoomState, identity: string): HandleResult {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may reset');
  }
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (status === CHESS_PUZZLE_PLAY_STATUS.idle) {
    return conflict('no puzzle in play to reset');
  }
  const layoutKey = ChessPuzzlePlayAttr.layoutKey.from(state) + 1;

  // Wrong-move retry: the wrong move was never applied, so keep the position
  // and `solveIdx`; the player picks back up at the same expected move.
  if (status === CHESS_PUZZLE_PLAY_STATUS.wrong) {
    return {
      ok: true,
      events: [
        ChessPuzzlePlayResetEvt({
          displayFen: ChessPuzzlePlayAttr.displayFen.from(state),
          solveIdx: ChessPuzzlePlayAttr.solveIdx.from(state),
          furthestSolveIdx: ChessPuzzlePlayAttr.furthestSolveIdx.from(state),
          status: CHESS_PUZZLE_PLAY_STATUS.solving,
          layoutKey,
        }),
      ],
    };
  }

  const fen = ChessPuzzlePlayAttr.fen.from(state);
  const moves = ChessPuzzlePlayAttr.moves.from(state);
  const setup = setupPuzzleStart(fen, moves);
  if (setup.kind === 'invalid') {
    return {
      ok: true,
      events: [
        ChessPuzzlePlayResetEvt({
          displayFen: null,
          solveIdx: 0,
          furthestSolveIdx: 0,
          status: CHESS_PUZZLE_PLAY_STATUS.invalid,
          layoutKey,
        }),
      ],
    };
  }
  return {
    ok: true,
    events: [
      ChessPuzzlePlayResetEvt({
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
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (
    status !== CHESS_PUZZLE_PLAY_STATUS.solving &&
    status !== CHESS_PUZZLE_PLAY_STATUS.solved &&
    status !== CHESS_PUZZLE_PLAY_STATUS.revealed
  ) {
    return conflict(`cannot step while status is ${status}`);
  }
  return null;
}

function emitSeekToSolveIdx(state: RoomState, nextIdx: number): HandleResult {
  const fen = ChessPuzzlePlayAttr.fen.from(state);
  const moves = ChessPuzzlePlayAttr.moves.from(state);
  const displayFen = fenAtSolveIdx({ fen, moves, solveIdx: nextIdx });
  if (displayFen === null) {
    return internal('could not rebuild fen for stepped solve index');
  }
  return {
    ok: true,
    events: [
      ChessPuzzlePlayStepped({
        displayFen,
        solveIdx: nextIdx,
        // Review after "Show solution" stays review while scrubbing.
        status:
          ChessPuzzlePlayAttr.status.from(state) ===
          CHESS_PUZZLE_PLAY_STATUS.revealed
            ? CHESS_PUZZLE_PLAY_STATUS.revealed
            : statusAtSolveIdx(nextIdx, puzzleTokensLength(moves)),
        layoutKey: ChessPuzzlePlayAttr.layoutKey.from(state) + 1,
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
  const solveIdx = ChessPuzzlePlayAttr.solveIdx.from(state);
  const furthest = ChessPuzzlePlayAttr.furthestSolveIdx.from(state);
  const tokensLength = puzzleTokensLength(
    ChessPuzzlePlayAttr.moves.from(state)
  );
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
    solveIdx: ChessPuzzlePlayAttr.solveIdx.from(state),
    furthestSolveIdx: ChessPuzzlePlayAttr.furthestSolveIdx.from(state),
    targetSolveIdx,
  });
  if (nextIdx === null) {
    return conflict('seek target is out of range or already current');
  }
  return emitSeekToSolveIdx(state, nextIdx);
}

function handleClear(state: RoomState, identity: string): HandleResult {
  const host = ChessPuzzlePlayAttr.hostIdentity.from(state);
  if (host !== null && host !== identity) {
    return unauthorized('only the puzzle host may clear');
  }
  return { ok: true, events: [ChessPuzzlePlayCleared({})] };
}

function handleReclaim(state: RoomState, identity: string): HandleResult {
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (status === CHESS_PUZZLE_PLAY_STATUS.idle) {
    return conflict('no puzzle in play to reclaim');
  }
  const host = ChessPuzzlePlayAttr.hostIdentity.from(state);
  if (host === identity) {
    return conflict('caller is already the puzzle host');
  }
  return {
    ok: true,
    events: [ChessPuzzleHostReclaimed({ hostIdentity: identity })],
  };
}

export const chessPuzzlePlayCommandRouter = createMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(chessPuzzlePlayCmdNs)
  .on(StartChessPuzzlePlay, (state, ctx, c) =>
    handleStart(state, ctx, c.payload)
  )
  .on(SubmitChessPuzzleMove, (state, ctx, c) =>
    handleSubmitMove(state, ctx, c.payload.uci)
  )
  .on(ResetChessPuzzlePlay, (state, ctx) => handleReset(state, ctx.identity))
  .on(StepBackChessPuzzlePlay, (state, ctx) =>
    handleStepSeek(state, ctx.identity, 'back')
  )
  .on(StepForwardChessPuzzlePlay, (state, ctx) =>
    handleStepSeek(state, ctx.identity, 'forward')
  )
  .on(SeekChessPuzzlePlay, (state, ctx, c) =>
    handleSeek(state, ctx.identity, c.payload.solveIdx)
  )
  .on(ClearChessPuzzlePlay, (state, ctx) => handleClear(state, ctx.identity))
  .on(RequestChessPuzzleHint, (state, ctx) =>
    handleRequestHint(state, ctx.identity)
  )
  .on(RevealChessPuzzleSolution, (state, ctx) =>
    handleRevealSolution(state, ctx.identity)
  )
  .on(ReclaimChessPuzzlePlay, (state, ctx) =>
    handleReclaim(state, ctx.identity)
  )
  .on(SkipChessPuzzlePlay, (state, ctx) => handleSkip(state, ctx))
  .on(ShowChessPuzzleSolution, (state, ctx) => handleShowSolution(state, ctx))
  .on(RecommendChessPuzzleMove, (state, ctx, c) =>
    handleRecommend(state, ctx.identity, c.payload)
  )
  .on(ClearChessPuzzleRecommendation, (state, ctx) =>
    handleClearRecommendation(state, ctx.identity)
  );

export {
  chessPuzzlePlayEventReducer,
  chessPuzzlePlayInitialAttrs,
} from './chess-puzzle-play-reducer';
