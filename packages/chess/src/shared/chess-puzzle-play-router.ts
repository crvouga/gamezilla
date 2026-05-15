import { createMessageRouter } from '@gamezilla/lib/message';
import {
  ROOM_ERROR_TYPE,
  type HandleResult,
  type RoomError,
  type RoomState,
} from '@gamezilla/room';
import { Chess } from 'chess.js';

import {
  applyUciToChess,
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
  chessPuzzlePlayEvtNs,
  ChessPuzzleHintRevealed,
  ChessPuzzlePlayCleared,
  ChessPuzzlePlayMoveAccepted,
  ChessPuzzlePlayMoveRejected,
  ChessPuzzlePlayResetEvt,
  ChessPuzzlePlayStarted,
  ClearChessPuzzlePlay,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
} from './chess-puzzle-play-messages';

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
      displayFen: string;
      solveIdx: number;
      status: ChessPuzzlePlayStatus;
    }
  | { error: HandleResult } {
  const { chess, actual, tokens, idx } = args;
  if (!applyUciToChess(chess, actual)) {
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
  return { uci: actual, displayFen: chess.fen(), solveIdx: nextIdx, status };
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
  if (
    status !== CHESS_PUZZLE_PLAY_STATUS.solving &&
    status !== CHESS_PUZZLE_PLAY_STATUS.wrong
  ) {
    return conflict(`cannot submit move while status is ${status}`);
  }
  const tokens = tokenize(ChessPuzzlePlayAttr.moves.from(state));
  const idx = ChessPuzzlePlayAttr.solveIdx.from(state);
  const expected = tokens[idx];
  if (expected === undefined) {
    return internal('no expected move at current solve index');
  }
  const actual = uci.trim().toLowerCase();
  if (actual !== expected) {
    const layoutKey = ChessPuzzlePlayAttr.layoutKey.from(state) + 1;
    const squares = uciToSquares(actual);
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
          uci: actual,
          layoutKey,
          wrongFromSquare: squares.from,
          wrongToSquare: squares.to,
        }),
      ],
    };
  }
  const chessOrErr = loadChessFromDisplayFen(
    ChessPuzzlePlayAttr.displayFen.from(state)
  );
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
        status: setup.status,
        layoutKey,
      }),
    ],
  };
}

function handleRequestHint(state: RoomState, identity: string): HandleResult {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may request a hint');
  }
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (status !== CHESS_PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot request hint while status is ${status}`);
  }
  const tokens = tokenize(ChessPuzzlePlayAttr.moves.from(state));
  const idx = ChessPuzzlePlayAttr.solveIdx.from(state);
  const expected = tokens[idx];
  if (expected === undefined) {
    return internal('no expected move at current solve index');
  }
  const squares = uciToSquares(expected);
  if (squares === null) {
    return internal('expected move uci is malformed');
  }
  const layoutKey = ChessPuzzlePlayAttr.layoutKey.from(state) + 1;
  return {
    ok: true,
    events: [
      ChessPuzzleHintRevealed({
        fromSquare: squares.from,
        toSquare: squares.to,
        layoutKey,
      }),
    ],
  };
}

function handleClear(state: RoomState, identity: string): HandleResult {
  const host = ChessPuzzlePlayAttr.hostIdentity.from(state);
  if (host !== null && host !== identity) {
    return unauthorized('only the puzzle host may clear');
  }
  return { ok: true, events: [ChessPuzzlePlayCleared({})] };
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
  .on(ClearChessPuzzlePlay, (state, identity) => handleClear(state, identity))
  .on(RequestChessPuzzleHint, (state, identity) =>
    handleRequestHint(state, identity)
  );

export const chessPuzzlePlayEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(chessPuzzlePlayEvtNs)
  .on(ChessPuzzlePlayStarted, (state, _ctx, ev) => {
    const p = ev.payload;
    return {
      ...state,
      ...ChessPuzzlePlayAttr.puzzleId(p.puzzleId),
      ...ChessPuzzlePlayAttr.fen(p.fen),
      ...ChessPuzzlePlayAttr.moves(p.moves),
      ...ChessPuzzlePlayAttr.hostIdentity(p.hostIdentity),
      ...ChessPuzzlePlayAttr.displayFen(p.displayFen),
      ...ChessPuzzlePlayAttr.orientation(p.orientation),
      ...ChessPuzzlePlayAttr.status(p.status),
      ...ChessPuzzlePlayAttr.solveIdx(p.solveIdx),
      ...ChessPuzzlePlayAttr.layoutKey(0),
      ...ChessPuzzlePlayAttr.wrongFromSquare(null),
      ...ChessPuzzlePlayAttr.wrongToSquare(null),
      ...ChessPuzzlePlayAttr.expectedFromSquare(null),
      ...ChessPuzzlePlayAttr.expectedToSquare(null),
    };
  })
  .on(ChessPuzzlePlayMoveAccepted, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
  }))
  .on(ChessPuzzlePlayMoveRejected, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.wrong),
    ...ChessPuzzlePlayAttr.wrongFromSquare(ev.payload.wrongFromSquare),
    ...ChessPuzzlePlayAttr.wrongToSquare(ev.payload.wrongToSquare),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
  }))
  .on(ChessPuzzlePlayResetEvt, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
  }))
  .on(ChessPuzzleHintRevealed, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.expectedFromSquare(ev.payload.fromSquare),
    ...ChessPuzzlePlayAttr.expectedToSquare(ev.payload.toSquare),
  }))
  .on(ChessPuzzlePlayCleared, (state) => ({
    ...state,
    ...ChessPuzzlePlayAttr.puzzleId(null),
    ...ChessPuzzlePlayAttr.fen(''),
    ...ChessPuzzlePlayAttr.moves(''),
    ...ChessPuzzlePlayAttr.hostIdentity(null),
    ...ChessPuzzlePlayAttr.displayFen(null),
    ...ChessPuzzlePlayAttr.orientation('white'),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.idle),
    ...ChessPuzzlePlayAttr.solveIdx(0),
    ...ChessPuzzlePlayAttr.layoutKey(0),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
  }));

/** Default values to seed in `SpaceModule.initialState()`. */
export function chessPuzzlePlayInitialAttrs(): RoomState {
  return {
    ...ChessPuzzlePlayAttr.puzzleId(null),
    ...ChessPuzzlePlayAttr.fen(''),
    ...ChessPuzzlePlayAttr.moves(''),
    ...ChessPuzzlePlayAttr.hostIdentity(null),
    ...ChessPuzzlePlayAttr.displayFen(null),
    ...ChessPuzzlePlayAttr.orientation('white'),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.idle),
    ...ChessPuzzlePlayAttr.solveIdx(0),
    ...ChessPuzzlePlayAttr.layoutKey(0),
    ...ChessPuzzlePlayAttr.wrongFromSquare(null),
    ...ChessPuzzlePlayAttr.wrongToSquare(null),
    ...ChessPuzzlePlayAttr.expectedFromSquare(null),
    ...ChessPuzzlePlayAttr.expectedToSquare(null),
  };
}
