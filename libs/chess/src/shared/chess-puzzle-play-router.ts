import { createMessageRouter } from '@pkgs/message';
import {
  ROOM_ERROR_TYPE,
  type HandleResult,
  type RoomError,
  type RoomState,
} from '@pkgs/room';
import { Chess } from 'chess.js';

import {
  applyUciToChess,
  applyUciToChessSan,
  setupPuzzleStart,
  tokenize,
  uciToSquares,
} from './chess-puzzle-fsm';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  type ChessPuzzlePlayStatus,
} from './chess-puzzle-play-attr';
import {
  chessPuzzlePlayCmdNs,
  ChessPuzzleHostReclaimed,
  ChessPuzzlePlayCleared,
  ChessPuzzlePlayMoveAccepted,
  ChessPuzzlePlayMoveRejected,
  ChessPuzzlePlayResetEvt,
  ChessPuzzlePlayStarted,
  ChessPuzzlePlayStepped,
  ClearChessPuzzlePlay,
  ReclaimChessPuzzlePlay,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  RevealChessPuzzleSolution,
  SeekChessPuzzlePlay,
  StartChessPuzzlePlay,
  StepBackChessPuzzlePlay,
  StepForwardChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from './chess-puzzle-play-messages';
import {
  handleRequestHint,
  handleRevealSolution,
} from './chess-puzzle-play-hint-handlers';
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

function loadChessFromDisplayFen(
  displayFen: string | null
): Chess | { error: HandleResult } {
  if (displayFen === null) {
    return { error: internal('cannot apply move without a display fen') };
  }
  const chess = new Chess();
  try {
    chess.load(displayFen);
  } catch {
    return { error: internal('display fen failed to load') };
  }
  return chess;
}

/**
 * Applies the host's `actual` UCI to `chess` and (if more solution remains)
 * the canned opponent reply. Returns the {@link ChessPuzzlePlayMoveAccepted}
 * payload or an error envelope.
 */
function applyAcceptedMove(args: {
  chess: Chess;
  actual: string;
  tokens: readonly string[];
  idx: number;
}):
  | {
      uci: string;
      san: string;
      displayFen: string;
      solveIdx: number;
      status: ChessPuzzlePlayStatus;
    }
  | { error: HandleResult } {
  const { chess, actual, tokens, idx } = args;
  const san = applyUciToChessSan(chess, actual);
  if (san === null) {
    return {
      error: reject({
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'illegal move for current position',
      }),
    };
  }
  let nextIdx = idx + 1;
  if (nextIdx >= tokens.length) {
    return {
      uci: actual,
      san,
      displayFen: chess.fen(),
      solveIdx: nextIdx,
      status: CHESS_PUZZLE_PLAY_STATUS.solved,
    };
  }
  const reply = tokens[nextIdx];
  if (reply === undefined) {
    return { error: internal('no opponent reply at next index') };
  }
  if (!applyUciToChess(chess, reply)) {
    return {
      error: internal('opponent reply did not apply to current position'),
    };
  }
  nextIdx += 1;
  const status =
    nextIdx >= tokens.length
      ? CHESS_PUZZLE_PLAY_STATUS.solved
      : CHESS_PUZZLE_PLAY_STATUS.solving;
  return {
    uci: actual,
    san,
    displayFen: chess.fen(),
    solveIdx: nextIdx,
    status,
  };
}

function handleSubmitMove(
  state: RoomState,
  identity: string,
  uci: string
): HandleResult {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may submit moves');
  }
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (status !== CHESS_PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot submit move while status is ${status}`);
  }
  const tokens = tokenize(ChessPuzzlePlayAttr.moves.from(state));
  const idx = ChessPuzzlePlayAttr.solveIdx.from(state);
  const expected = tokens[idx];
  if (expected === undefined) {
    return internal('no expected move at current solve index');
  }
  const actual = uci.trim().toLowerCase();
  const previousDisplayFen = ChessPuzzlePlayAttr.displayFen.from(state);
  if (actual !== expected) {
    return handleWrongMove({ state, actual, previousDisplayFen });
  }
  const chessOrErr = loadChessFromDisplayFen(previousDisplayFen);
  if ('error' in chessOrErr) return chessOrErr.error;
  const applied = applyAcceptedMove({
    chess: chessOrErr,
    actual,
    tokens,
    idx,
  });
  if ('error' in applied) return applied.error;
  return {
    ok: true,
    events: [ChessPuzzlePlayMoveAccepted(applied)],
  };
}

/**
 * Handle a syntactically-valid but wrong UCI: apply it to the board so the
 * player sees the position they reached, then capture both the new and the
 * pre-move FEN so `Retry` can revert just the wrong ply.
 */
function handleWrongMove(args: {
  state: RoomState;
  actual: string;
  previousDisplayFen: string | null;
}): HandleResult {
  const { state, actual, previousDisplayFen } = args;
  const layoutKey = ChessPuzzlePlayAttr.layoutKey.from(state) + 1;
  const squares = uciToSquares(actual);
  if (squares === null) {
    return reject({
      type: ROOM_ERROR_TYPE.invalidCommand,
      reason: 'malformed uci for rejected move',
    });
  }
  const chessOrErr = loadChessFromDisplayFen(previousDisplayFen);
  if ('error' in chessOrErr) return chessOrErr.error;
  const san = applyUciToChessSan(chessOrErr, actual);
  if (san === null) {
    return reject({
      type: ROOM_ERROR_TYPE.invalidCommand,
      reason: 'illegal move for current position',
    });
  }
  // `previousDisplayFen` is non-null here: `loadChessFromDisplayFen` rejects null.
  const prev = previousDisplayFen ?? '';
  return {
    ok: true,
    events: [
      ChessPuzzlePlayMoveRejected({
        uci: actual,
        san,
        layoutKey,
        wrongFromSquare: squares.from,
        wrongToSquare: squares.to,
        displayFen: chessOrErr.fen(),
        previousDisplayFen: prev,
      }),
    ],
  };
}

function handleStart(
  state: RoomState,
  identity: string,
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
          hostIdentity: identity,
          displayFen: null,
          orientation: 'white',
          status: CHESS_PUZZLE_PLAY_STATUS.invalid,
          solveIdx: 0,
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
        hostIdentity: identity,
        displayFen: setup.displayFen,
        orientation: setup.orientation,
        status: setup.status,
        solveIdx: 1,
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

  // Wrong-move retry: undo just the wrong move, keep `solveIdx` so the
  // player picks back up where the puzzle expected the same correct move.
  if (status === CHESS_PUZZLE_PLAY_STATUS.wrong) {
    const previous = ChessPuzzlePlayAttr.previousDisplayFen.from(state);
    if (previous !== null) {
      const solveIdx = ChessPuzzlePlayAttr.solveIdx.from(state);
      return {
        ok: true,
        events: [
          ChessPuzzlePlayResetEvt({
            displayFen: previous,
            solveIdx,
            furthestSolveIdx: ChessPuzzlePlayAttr.furthestSolveIdx.from(state),
            status: CHESS_PUZZLE_PLAY_STATUS.solving,
            layoutKey,
          }),
        ],
      };
    }
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
    status !== CHESS_PUZZLE_PLAY_STATUS.solved
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
        status: statusAtSolveIdx(nextIdx, puzzleTokensLength(moves)),
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
  string,
  HandleResult
>(chessPuzzlePlayCmdNs)
  .on(StartChessPuzzlePlay, (state, identity, c) =>
    handleStart(state, identity, c.payload)
  )
  .on(SubmitChessPuzzleMove, (state, identity, c) =>
    handleSubmitMove(state, identity, c.payload.uci)
  )
  .on(ResetChessPuzzlePlay, (state, identity) => handleReset(state, identity))
  .on(StepBackChessPuzzlePlay, (state, identity) =>
    handleStepSeek(state, identity, 'back')
  )
  .on(StepForwardChessPuzzlePlay, (state, identity) =>
    handleStepSeek(state, identity, 'forward')
  )
  .on(SeekChessPuzzlePlay, (state, identity, c) =>
    handleSeek(state, identity, c.payload.solveIdx)
  )
  .on(ClearChessPuzzlePlay, (state, identity) => handleClear(state, identity))
  .on(RequestChessPuzzleHint, (state, identity) =>
    handleRequestHint(state, identity)
  )
  .on(RevealChessPuzzleSolution, (state, identity) =>
    handleRevealSolution(state, identity)
  )
  .on(ReclaimChessPuzzlePlay, (state, identity) =>
    handleReclaim(state, identity)
  );

export {
  chessPuzzlePlayEventReducer,
  chessPuzzlePlayInitialAttrs,
} from './chess-puzzle-play-reducer';
