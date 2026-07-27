import {
  ROOM_ERROR_TYPE,
  type HandleResult,
  type RoomEvent,
  type RoomState,
} from '@pkgs/room';

import { tokenize, uciToSquares } from './chess-puzzle-fsm';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
} from './chess-puzzle-play-attr';
import {
  ChessPuzzleHintRevealed,
  ChessPuzzleSolutionRevealed,
} from './chess-puzzle-play-messages';

type HintHandleResult = HandleResult;

function unauthorized(reason: string): HintHandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.unauthorized, reason },
  };
}

function conflict(reason: string): HintHandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.conflict, reason },
  };
}

function internal(reason: string): HintHandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.internal, reason },
  };
}

function isHostOf(state: RoomState, identity: string): boolean {
  const host = ChessPuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

function buildHintEvents(state: RoomState): HintHandleResult {
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (
    status !== CHESS_PUZZLE_PLAY_STATUS.solving &&
    status !== CHESS_PUZZLE_PLAY_STATUS.wrong
  ) {
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

export function handleRequestHint(
  state: RoomState,
  identity: string
): HintHandleResult {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may request a hint');
  }
  return buildHintEvents(state);
}

export function handleRevealSolution(
  state: RoomState,
  identity: string
): HintHandleResult {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may reveal the solution');
  }
  if (ChessPuzzlePlayAttr.solutionRevealed.from(state)) {
    return conflict('solution already revealed');
  }

  const from = ChessPuzzlePlayAttr.expectedFromSquare.from(state);
  const to = ChessPuzzlePlayAttr.expectedToSquare.from(state);
  const events: RoomEvent[] = [];

  // One-shot Solution (wrong-mode bar): materialize hint squares first.
  if (from === null || to === null) {
    const hint = buildHintEvents(state);
    if (!hint.ok) return hint;
    events.push(...hint.events);
  }

  events.push(ChessPuzzleSolutionRevealed({}));
  return { ok: true, events };
}
