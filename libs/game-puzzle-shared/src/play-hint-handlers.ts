import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { PUZZLE_PLAY_STATUS, PuzzlePlayAttr } from './play-attr';
import { PuzzleHintRevealed, PuzzleSolutionRevealed } from './play-messages';
import type { PuzzleGame } from './puzzle-setup';
import { lineActions } from './step';

function unauthorized(reason: string): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.unauthorized, reason },
  };
}

function conflict(reason: string): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.conflict, reason },
  };
}

function internal(reason: string): HandleResult {
  return {
    ok: false,
    error: { type: ROOM_ERROR_TYPE.internal, reason },
  };
}

function isHostOf(state: RoomState, identity: string): boolean {
  const host = PuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

function requireCurrentSolvingPosition(state: RoomState): HandleResult | null {
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

/** The hint: the cells the line's expected action names (`PuzzleMarks`). */
function buildHintEvents(state: RoomState, game: PuzzleGame): HandleResult {
  const denied = requireCurrentSolvingPosition(state);
  if (denied !== null) return denied;
  if (
    PuzzlePlayAttr.hintFrom.from(state) !== null ||
    PuzzlePlayAttr.hintTo.from(state) !== null
  ) {
    return conflict('the first hint is already taken');
  }
  const line = lineActions(PuzzlePlayAttr.line.from(state));
  const idx = PuzzlePlayAttr.solveIdx.from(state);
  const expected = line[idx];
  if (expected === undefined) {
    return internal('no expected move at current solve index');
  }
  const position = PuzzlePlayAttr.displayPosition.from(state) ?? '';
  const marks = game.puzzles.marks(position, expected);
  if (marks === null) {
    return internal('expected move names no cells');
  }
  const layoutKey = PuzzlePlayAttr.layoutKey.from(state) + 1;
  return {
    ok: true,
    events: [
      PuzzleHintRevealed({
        // A move placed on one cell starts and ends there.
        fromSquare: marks.from ?? marks.to,
        toSquare: marks.to,
        layoutKey,
      }),
    ],
  };
}

export function handleRequestHint(
  state: RoomState,
  identity: string,
  game: PuzzleGame
): HandleResult {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may request a hint');
  }
  return buildHintEvents(state, game);
}

export function handleRevealSolution(
  state: RoomState,
  identity: string
): HandleResult {
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
