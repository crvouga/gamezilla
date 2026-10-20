import type { GameCommandContext } from '@libs/spaces-shared/game';
import type { MessageRouter } from '@pkgs/message-shared/router';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type {
  HandleResult,
  RoomError,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { puzzleLineLayout } from '@pkgs/turn-game-shared/game-puzzles';
import type { PuzzlePlayStatus } from './play-attr';
import { PUZZLE_PLAY_STATUS, PuzzlePlayAttr } from './play-attr';
import { handleRequestHint, handleRevealSolution } from './play-hint-handlers';
import {
  ClearPuzzlePlay,
  ClearPuzzleRecommendation,
  PuzzleHostReclaimed,
  PuzzlePlayCleared,
  PuzzlePlayMoveAccepted,
  PuzzlePlayMoveRejected,
  PuzzlePlayResetEvt,
  PuzzlePlayStarted,
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
} from './play-messages';
import {
  handleClearRecommendation,
  handleRecommend,
} from './play-recommendation-handlers';
import { handleSeek, handleStepSeek } from './play-seek-handlers';
import { handleShowSolution, handleSkip } from './play-terminal-handlers';
import type { PuzzleGameLookup } from './puzzle-game-lookup';
import { gameInPlay } from './puzzle-game-lookup';
import type { PuzzleMoveAccepted } from './puzzle-judge';
import { judgePuzzleAction } from './puzzle-judge';
import type { PuzzleGame } from './puzzle-setup';
import { playPuzzleAction, setupPuzzle } from './puzzle-setup';
import { lineActions } from './step';

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
  game: PuzzleGame;
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
  const { game, accepted, idx, ts } = args;
  const base = {
    uci: accepted.action,
    san: accepted.label,
    moves: accepted.line.join(' '),
  };
  const replyIdx = idx + 1;
  const reply = accepted.line[replyIdx];
  if (
    accepted.ends ||
    reply === undefined ||
    puzzleLineLayout(game.puzzles).solverStep === 1
  ) {
    const solved = accepted.ends || reply === undefined;
    return {
      ...base,
      displayFen: accepted.position,
      solveIdx: replyIdx,
      status: solved ? PUZZLE_PLAY_STATUS.solved : PUZZLE_PLAY_STATUS.solving,
      endedAtMs: solved ? ts : null,
    };
  }
  const replied = playPuzzleAction(game, accepted.position, reply);
  if (replied === null) {
    return {
      error: internal('opponent reply did not apply to current position'),
    };
  }
  const solveIdx = replyIdx + 1;
  const solved = solveIdx >= accepted.line.length;
  return {
    ...base,
    displayFen: replied.played.position,
    solveIdx,
    status: solved ? PUZZLE_PLAY_STATUS.solved : PUZZLE_PLAY_STATUS.solving,
    endedAtMs: solved ? ts : null,
  };
}

function handleSubmitMove(
  state: RoomState,
  ctx: GameCommandContext,
  action: string,
  lookup: PuzzleGameLookup
): HandleResult {
  if (!isHostOf(state, ctx.identity)) {
    return unauthorized('only the puzzle host may submit moves');
  }
  const status = PuzzlePlayAttr.status.from(state);
  if (status !== PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot submit move while status is ${status}`);
  }
  const line = lineActions(PuzzlePlayAttr.line.from(state));
  const idx = PuzzlePlayAttr.solveIdx.from(state);
  if (idx !== PuzzlePlayAttr.furthestSolveIdx.from(state)) {
    return conflict('return to the current position before submitting a move');
  }
  const position = PuzzlePlayAttr.displayPosition.from(state);
  if (line[idx] === undefined) {
    return internal('no expected move at current solve index');
  }
  if (position === null)
    return internal('cannot apply move without a display position');
  const game = gameInPlay(state, lookup);
  if (game === null) return internal('the puzzle in play names no game');
  const verdict = judgePuzzleAction({
    game,
    position,
    line,
    idx,
    solverSide: PuzzlePlayAttr.solverSide.from(state),
    action,
  });
  if (verdict.kind === 'illegal') {
    return reject({
      type: ROOM_ERROR_TYPE.invalidCommand,
      reason: 'illegal move for current position',
    });
  }
  if (verdict.kind === 'wrong') {
    return handleWrongMove(state, game, position, verdict);
  }
  const applied = acceptedMovePayload({
    game,
    accepted: verdict,
    idx,
    ts: ctx.ts,
  });
  if ('error' in applied) return applied.error;
  return {
    ok: true,
    events: [PuzzlePlayMoveAccepted(applied)],
  };
}

/**
 * A legal but wrong move is never applied to the reached position: the
 * display position keeps the position the solver moved from, the board
 * shows the move where it ended (its mark), flagged, and the attempt turns
 * `wrong` (§5).
 */
function handleWrongMove(
  state: RoomState,
  game: PuzzleGame,
  position: string,
  verdict: { readonly action: string; readonly label: string }
): HandleResult {
  const marks = game.puzzles.marks(position, verdict.action);
  if (marks === null) {
    return reject({
      type: ROOM_ERROR_TYPE.invalidCommand,
      reason: 'the rejected move names no cells',
    });
  }
  return {
    ok: true,
    events: [
      PuzzlePlayMoveRejected({
        uci: verdict.action,
        san: verdict.label,
        layoutKey: PuzzlePlayAttr.layoutKey.from(state) + 1,
        wrongToSquare: marks.to,
      }),
    ],
  };
}

function handleStart(
  state: RoomState,
  ctx: GameCommandContext,
  payload: { puzzleId: string; fen: string; moves: string },
  lookup: PuzzleGameLookup
): HandleResult {
  if (PuzzlePlayAttr.hostIdentity.from(state) !== null) {
    return conflict('puzzle play already started; clear first');
  }
  const { puzzleId, fen, moves } = payload;
  const game = lookup(fen);
  if (game === 'unoffered') {
    return reject({
      type: ROOM_ERROR_TYPE.invalidCommand,
      reason: "the puzzle's game does not offer puzzles",
    });
  }
  const setup =
    game === null
      ? ({ kind: 'invalid' } as const)
      : setupPuzzle(game, fen, lineActions(moves));
  const started = {
    puzzleId,
    fen,
    moves,
    hostIdentity: ctx.identity,
    startedAtMs: ctx.ts,
    attemptId: ctx.commandId,
  };
  if (setup.kind === 'invalid') {
    return {
      ok: true,
      events: [
        PuzzlePlayStarted({
          ...started,
          displayFen: null,
          orientation: 'white',
          status: PUZZLE_PLAY_STATUS.invalid,
          solveIdx: 0,
        }),
      ],
    };
  }
  return {
    ok: true,
    events: [
      PuzzlePlayStarted({
        ...started,
        displayFen: setup.displayPosition,
        orientation: setup.solverSide,
        status: setup.status,
        solveIdx: setup.solveIdx,
      }),
    ],
  };
}

function handleReset(
  state: RoomState,
  identity: string,
  lookup: PuzzleGameLookup
): HandleResult {
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

  const game = gameInPlay(state, lookup);
  const setup =
    game === null
      ? ({ kind: 'invalid' } as const)
      : setupPuzzle(
          game,
          PuzzlePlayAttr.position.from(state),
          lineActions(PuzzlePlayAttr.line.from(state))
        );
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
        displayFen: setup.displayPosition,
        solveIdx: setup.solveIdx,
        furthestSolveIdx: setup.solveIdx,
        status: setup.status,
        layoutKey,
      }),
    ],
  };
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

/** A hint needs the puzzle's game for the cells its move names. */
function handleHint(
  state: RoomState,
  identity: string,
  lookup: PuzzleGameLookup
): HandleResult {
  const game = gameInPlay(state, lookup);
  if (game === null && isHostOf(state, identity))
    return conflict(
      `cannot request hint while status is ${PuzzlePlayAttr.status.from(state)}`
    );
  return game === null
    ? unauthorized('only the puzzle host may request a hint')
    : handleRequestHint(state, identity, game);
}

/** A show-solution needs the puzzle's game to play the rest of the line. */
function handleShow(
  state: RoomState,
  ctx: GameCommandContext,
  lookup: PuzzleGameLookup
): HandleResult {
  const game = gameInPlay(state, lookup);
  if (game === null && isHostOf(state, ctx.identity))
    return conflict(
      `cannot show the solution while status is ${PuzzlePlayAttr.status.from(state)}`
    );
  return game === null
    ? unauthorized('only the puzzle host may show the solution')
    : handleShowSolution(state, ctx, game);
}

/**
 * The space's puzzle session: one host solves, every member watches and may
 * suggest, over the rules of whichever game the puzzle's position belongs
 * to (`lookup`).
 */
export function createPuzzlePlayCommandRouter(
  lookup: PuzzleGameLookup
): MessageRouter<RoomState, GameCommandContext, HandleResult> {
  return createMessageRouter<RoomState, GameCommandContext, HandleResult>(
    puzzlePlayCmdNs
  )
    .on(StartPuzzlePlay, (state, ctx, c) =>
      handleStart(state, ctx, c.payload, lookup)
    )
    .on(SubmitPuzzleMove, (state, ctx, c) =>
      handleSubmitMove(state, ctx, c.payload.uci, lookup)
    )
    .on(ResetPuzzlePlay, (state, ctx) =>
      handleReset(state, ctx.identity, lookup)
    )
    .on(StepBackPuzzlePlay, (state, ctx) =>
      handleStepSeek(state, ctx.identity, 'back', lookup)
    )
    .on(StepForwardPuzzlePlay, (state, ctx) =>
      handleStepSeek(state, ctx.identity, 'forward', lookup)
    )
    .on(SeekPuzzlePlay, (state, ctx, c) =>
      handleSeek(state, ctx.identity, c.payload.solveIdx, lookup)
    )
    .on(ClearPuzzlePlay, (state, ctx) => handleClear(state, ctx.identity))
    .on(RequestPuzzleHint, (state, ctx) =>
      handleHint(state, ctx.identity, lookup)
    )
    .on(RevealPuzzleSolution, (state, ctx) =>
      handleRevealSolution(state, ctx.identity)
    )
    .on(ReclaimPuzzlePlay, (state, ctx) => handleReclaim(state, ctx.identity))
    .on(SkipPuzzlePlay, (state, ctx) => handleSkip(state, ctx))
    .on(ShowPuzzleSolution, (state, ctx) => handleShow(state, ctx, lookup))
    .on(RecommendPuzzleMove, (state, ctx, c) =>
      handleRecommend(state, ctx.identity, c.payload, gameInPlay(state, lookup))
    )
    .on(ClearPuzzleRecommendation, (state, ctx) =>
      handleClearRecommendation(state, ctx.identity)
    );
}
