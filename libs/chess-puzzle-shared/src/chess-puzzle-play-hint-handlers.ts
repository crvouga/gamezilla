import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared/play-attr';
import {
  PuzzleHintRevealed,
  PuzzleSolutionRevealed,
} from '@libs/game-puzzle-shared/play-messages';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { tokenize, uciToSquares } from './chess-puzzle-fsm';

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
  const host = PuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

function requireCurrentSolvingPosition(
  state: RoomState
): HintHandleResult | null {
  const status = PuzzlePlayAttr.status.from(state);
  if (status !== PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot request hint while status is ${status}`);
  }
  if (
    PuzzlePlayAttr.solveIdx.from(state) !==
    PuzzlePlayAttr.furthestSolveIdx.from(state)
  ) {
    return conflict('return to the current position before requesting help');
  }
  return null;
}

function buildHintEvents(state: RoomState): HintHandleResult {
  const denied = requireCurrentSolvingPosition(state);
  if (denied !== null) return denied;
  if (
    PuzzlePlayAttr.hintFrom.from(state) !== null ||
    PuzzlePlayAttr.hintTo.from(state) !== null
  ) {
    return conflict('the first hint is already taken');
  }
  const tokens = tokenize(PuzzlePlayAttr.line.from(state));
  const idx = PuzzlePlayAttr.solveIdx.from(state);
  const expected = tokens[idx];
  if (expected === undefined) {
    return internal('no expected move at current solve index');
  }
  const squares = uciToSquares(expected);
  if (squares === null) {
    return internal('expected move uci is malformed');
  }
  const layoutKey = PuzzlePlayAttr.layoutKey.from(state) + 1;
  return {
    ok: true,
    events: [
      PuzzleHintRevealed({
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
  if (PuzzlePlayAttr.solutionRevealed.from(state)) {
    return conflict('solution already revealed');
  }
  const denied = requireCurrentSolvingPosition(state);
  if (denied !== null) return denied;
  const from = PuzzlePlayAttr.hintFrom.from(state);
  const to = PuzzlePlayAttr.hintTo.from(state);
  if (from === null || to === null) {
    return conflict('take the first hint before revealing the solution move');
  }
  return { ok: true, events: [PuzzleSolutionRevealed({})] };
}
