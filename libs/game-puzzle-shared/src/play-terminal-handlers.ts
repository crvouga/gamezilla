import type { GameCommandContext } from '@libs/spaces-shared/game';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { PUZZLE_PLAY_STATUS, PuzzlePlayAttr } from './play-attr';
import { PuzzlePlaySkipped, PuzzleSolutionShown } from './play-messages';
import type { PuzzleGame } from './puzzle-setup';
import { positionAt } from './puzzle-setup';
import { lineActions } from './step';

function isHostOf(state: RoomState, identity: string): boolean {
  const host = PuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

function isLiveAttempt(state: RoomState): boolean {
  const status = PuzzlePlayAttr.status.from(state);
  return (
    status === PUZZLE_PLAY_STATUS.solving || status === PUZZLE_PLAY_STATUS.wrong
  );
}

/**
 * "Show solution" (§6): jump the room to the end of the line. Clients play
 * the skipped plies out with animation (opponent stager) before review; the
 * attempt's outcome (a fail unless already resolved) is the recorder's job.
 */
export function handleShowSolution(
  state: RoomState,
  ctx: GameCommandContext,
  game: PuzzleGame
): HandleResult {
  if (!isHostOf(state, ctx.identity)) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.unauthorized,
        reason: 'only the puzzle host may show the solution',
      },
    };
  }
  if (!isLiveAttempt(state)) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.conflict,
        reason: `cannot show the solution while status is ${PuzzlePlayAttr.status.from(state)}`,
      },
    };
  }
  if (
    PuzzlePlayAttr.solveIdx.from(state) !==
    PuzzlePlayAttr.furthestSolveIdx.from(state)
  ) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.conflict,
        reason: 'return to the current position before showing the solution',
      },
    };
  }
  const line = lineActions(PuzzlePlayAttr.line.from(state));
  const solveIdx = line.length;
  const displayFen = positionAt(
    game,
    PuzzlePlayAttr.position.from(state),
    line,
    solveIdx
  );
  if (displayFen === null) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.internal,
        reason: 'could not rebuild the final position of the line',
      },
    };
  }
  return {
    ok: true,
    events: [PuzzleSolutionShown({ displayFen, solveIdx, endedAtMs: ctx.ts })],
  };
}

/** Host abandons the live attempt without solving it (terminal; a loss unless already resolved). */
export function handleSkip(
  state: RoomState,
  ctx: GameCommandContext
): HandleResult {
  if (!isHostOf(state, ctx.identity)) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.unauthorized,
        reason: 'only the puzzle host may skip',
      },
    };
  }
  if (!isLiveAttempt(state)) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.conflict,
        reason: `cannot skip while status is ${PuzzlePlayAttr.status.from(state)}`,
      },
    };
  }
  return {
    ok: true,
    events: [PuzzlePlaySkipped({ endedAtMs: ctx.ts })],
  };
}
