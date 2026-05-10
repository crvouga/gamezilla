import { createAttrNamespace } from '@gamezilla/lib/attribute';
import {
  createMessageNamespace,
  createMessageRouter,
  isPlainRecord,
} from '@gamezilla/lib/message';
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
  type ChessPuzzleOrientation,
} from './chess-puzzle-fsm';

/**
 * FSM state stored at `chess.puzzle-play/status`. The session lifecycle is:
 *
 * - `idle`: no puzzle in play (default; also after `ClearChessPuzzlePlay`).
 * - `solving`: puzzle started, awaiting host's next move.
 * - `wrong`: host's last move did not match the solution; awaiting retry.
 * - `solved`: solution complete.
 * - `invalid`: puzzle FEN / moves payload could not be parsed or applied.
 */
export const CHESS_PUZZLE_PLAY_STATUS = {
  idle: 'idle',
  solving: 'solving',
  wrong: 'wrong',
  solved: 'solved',
  invalid: 'invalid',
} as const;

export type ChessPuzzlePlayStatus =
  (typeof CHESS_PUZZLE_PLAY_STATUS)[keyof typeof CHESS_PUZZLE_PLAY_STATUS];

const ALL_STATUSES: ReadonlySet<string> = new Set<string>(
  Object.values(CHESS_PUZZLE_PLAY_STATUS)
);

function readStatus(v: unknown): ChessPuzzlePlayStatus {
  if (typeof v === 'string' && ALL_STATUSES.has(v)) {
    return v as ChessPuzzlePlayStatus;
  }
  return CHESS_PUZZLE_PLAY_STATUS.idle;
}

function readNullableNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNonNegativeInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  return 0;
}

function readOrientation(v: unknown): ChessPuzzleOrientation {
  return v === 'black' ? 'black' : 'white';
}

const playNs = createAttrNamespace('chess', 'puzzle-play');

/** Room state slice for the active chess puzzle solving session. */
export const ChessPuzzlePlayAttr = {
  /** Lichess `PuzzleId` of the puzzle currently being solved (null when `idle`). */
  puzzleId: playNs('puzzle-id', readNullableNonEmptyString),
  /** Identity captured from the dispatcher of the first `StartChessPuzzlePlay`. */
  hostIdentity: playNs('host-identity', readNullableNonEmptyString),
  /** Initial FEN of the puzzle (before the opponent's first move). */
  fen: playNs('fen', readString),
  /** Space-separated UCI tokens of the full solution line (incl. opponent's first move). */
  moves: playNs('moves', readString),
  status: playNs('status', readStatus),
  /** Index of the next expected token in `moves`. */
  solveIdx: playNs('solve-idx', readNonNegativeInteger),
  /** FEN currently rendered on the board (after applied moves). */
  displayFen: playNs('display-fen', readNullableNonEmptyString),
  /** Side the host is sitting on; fixed for the session. */
  orientation: playNs('orientation', readOrientation),
  /** Bumps on every wrong-move / reset so the chess board can force a remount when FEN string is unchanged. */
  layoutKey: playNs('layout-key', readNonNegativeInteger),
} as const;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isNullOrNonEmptyString(v: unknown): v is string | null {
  return v === null || isNonEmptyString(v);
}

function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isOrientation(v: unknown): v is ChessPuzzleOrientation {
  return v === 'white' || v === 'black';
}

function isStatus(v: unknown): v is ChessPuzzlePlayStatus {
  return typeof v === 'string' && ALL_STATUSES.has(v);
}

function validateStartPayload(
  payload: unknown
): payload is { puzzleId: string; fen: string; moves: string } {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['puzzleId']) &&
    isNonEmptyString(payload['fen']) &&
    isNonEmptyString(payload['moves'])
  );
}

function validateSubmitMovePayload(
  payload: unknown
): payload is { uci: string } {
  if (!isPlainRecord(payload)) return false;
  const uci = payload['uci'];
  if (typeof uci !== 'string') return false;
  const t = uci.trim();
  return t.length >= 4 && t.length <= 5;
}

function validateEmptyPayload(
  payload: unknown
): payload is Record<string, never> {
  return isPlainRecord(payload) && Object.keys(payload).length === 0;
}

function validateStartedPayload(payload: unknown): payload is {
  puzzleId: string;
  fen: string;
  moves: string;
  hostIdentity: string;
  displayFen: string | null;
  orientation: ChessPuzzleOrientation;
  status: ChessPuzzlePlayStatus;
  solveIdx: number;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['puzzleId']) &&
    isNonEmptyString(payload['fen']) &&
    isNonEmptyString(payload['moves']) &&
    isNonEmptyString(payload['hostIdentity']) &&
    isNullOrNonEmptyString(payload['displayFen']) &&
    isOrientation(payload['orientation']) &&
    isStatus(payload['status']) &&
    isNonNegativeInteger(payload['solveIdx'])
  );
}

function validateMoveAcceptedPayload(payload: unknown): payload is {
  uci: string;
  displayFen: string;
  solveIdx: number;
  status: ChessPuzzlePlayStatus;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['uci']) &&
    isNonEmptyString(payload['displayFen']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isStatus(payload['status'])
  );
}

function validateMoveRejectedPayload(
  payload: unknown
): payload is { uci: string; layoutKey: number } {
  if (!isPlainRecord(payload)) return false;
  return (
    isNonEmptyString(payload['uci']) &&
    isNonNegativeInteger(payload['layoutKey'])
  );
}

function validateResetEvtPayload(payload: unknown): payload is {
  displayFen: string | null;
  solveIdx: number;
  status: ChessPuzzlePlayStatus;
  layoutKey: number;
} {
  if (!isPlainRecord(payload)) return false;
  return (
    isNullOrNonEmptyString(payload['displayFen']) &&
    isNonNegativeInteger(payload['solveIdx']) &&
    isStatus(payload['status']) &&
    isNonNegativeInteger(payload['layoutKey'])
  );
}

export const chessPuzzlePlayCmdNs = createMessageNamespace(
  'chess-puzzle-play-cmd'
);

/**
 * Begin a puzzle solving session. The dispatcher's identity is captured into
 * {@link ChessPuzzlePlayAttr.hostIdentity} on success — that identity is the
 * only one allowed to subsequently submit moves, reset, or clear.
 */
export const StartChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'start',
  validateStartPayload
);

/** Host attempts the next move in the solution line. */
export const SubmitChessPuzzleMove = chessPuzzlePlayCmdNs(
  'submit-move',
  validateSubmitMovePayload
);

/** Host rewinds to the post-opening position and clears `wrong` / `solved` status. */
export const ResetChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'reset',
  validateEmptyPayload
);

/** Tear down the session entirely (returns all attrs to defaults). */
export const ClearChessPuzzlePlay = chessPuzzlePlayCmdNs(
  'clear',
  validateEmptyPayload
);

export const chessPuzzlePlayEvtNs = createMessageNamespace(
  'chess-puzzle-play-evt'
);

export const ChessPuzzlePlayStarted = chessPuzzlePlayEvtNs(
  'started',
  validateStartedPayload
);

export const ChessPuzzlePlayMoveAccepted = chessPuzzlePlayEvtNs(
  'move-accepted',
  validateMoveAcceptedPayload
);

export const ChessPuzzlePlayMoveRejected = chessPuzzlePlayEvtNs(
  'move-rejected',
  validateMoveRejectedPayload
);

export const ChessPuzzlePlayResetEvt = chessPuzzlePlayEvtNs(
  'reset',
  validateResetEvtPayload
);

export const ChessPuzzlePlayCleared = chessPuzzlePlayEvtNs(
  'cleared',
  validateEmptyPayload
);

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
    return {
      ok: true,
      events: [ChessPuzzlePlayMoveRejected({ uci: actual, layoutKey })],
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
  .on(ClearChessPuzzlePlay, (state, identity) => handleClear(state, identity));

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
    };
  })
  .on(ChessPuzzlePlayMoveAccepted, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
  }))
  .on(ChessPuzzlePlayMoveRejected, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
    ...ChessPuzzlePlayAttr.status(CHESS_PUZZLE_PLAY_STATUS.wrong),
  }))
  .on(ChessPuzzlePlayResetEvt, (state, _ctx, ev) => ({
    ...state,
    ...ChessPuzzlePlayAttr.displayFen(ev.payload.displayFen),
    ...ChessPuzzlePlayAttr.solveIdx(ev.payload.solveIdx),
    ...ChessPuzzlePlayAttr.status(ev.payload.status),
    ...ChessPuzzlePlayAttr.layoutKey(ev.payload.layoutKey),
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
  };
}
