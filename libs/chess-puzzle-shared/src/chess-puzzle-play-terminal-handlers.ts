import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared/play-attr';
import {
  PuzzlePlaySkipped,
  PuzzleSolutionShown,
} from '@libs/game-puzzle-shared/play-messages';
import { lineLength } from '@libs/game-puzzle-shared/step';
import type { GameCommandContext } from '@libs/spaces-shared/game';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { fenAtSolveIdx } from './chess-puzzle-step';

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
  ctx: GameCommandContext
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
  const fen = PuzzlePlayAttr.position.from(state);
  const moves = PuzzlePlayAttr.line.from(state);
  const solveIdx = lineLength(moves);
  const displayFen = fenAtSolveIdx({ fen, moves, solveIdx });
  if (displayFen === null) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.internal,
        reason: 'could not rebuild the final fen of the line',
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
