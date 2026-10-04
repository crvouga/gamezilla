import type { HandleResult, RoomState } from '@pkgs/room-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-shared/types';

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

function requireCurrentSolvingPosition(
  state: RoomState
): HintHandleResult | null {
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (status !== CHESS_PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot request hint while status is ${status}`);
  }
  if (
    ChessPuzzlePlayAttr.solveIdx.from(state) !==
    ChessPuzzlePlayAttr.furthestSolveIdx.from(state)
  ) {
    return conflict('return to the current position before requesting help');
  }
  return null;
}

function buildHintEvents(state: RoomState): HintHandleResult {
  const denied = requireCurrentSolvingPosition(state);
  if (denied !== null) return denied;
  if (
    ChessPuzzlePlayAttr.expectedFromSquare.from(state) !== null ||
    ChessPuzzlePlayAttr.expectedToSquare.from(state) !== null
  ) {
    return conflict('the first hint is already taken');
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
  const denied = requireCurrentSolvingPosition(state);
  if (denied !== null) return denied;
  const from = ChessPuzzlePlayAttr.expectedFromSquare.from(state);
  const to = ChessPuzzlePlayAttr.expectedToSquare.from(state);
  if (from === null || to === null) {
    return conflict('take the first hint before revealing the solution move');
  }
  return { ok: true, events: [ChessPuzzleSolutionRevealed({})] };
}
