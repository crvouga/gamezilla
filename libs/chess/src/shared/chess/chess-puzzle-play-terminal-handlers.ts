import type { GameCommandContext } from '@libs/spaces/public/game';
import { type HandleResult, ROOM_ERROR_TYPE, type RoomState } from '@pkgs/room';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
} from './chess-puzzle-play-attr';
import {
  ChessPuzzlePlaySkipped,
  ChessPuzzleSolutionShown,
} from './chess-puzzle-play-messages';
import { fenAtSolveIdx, puzzleTokensLength } from './chess-puzzle-step';

function isHostOf(state: RoomState, identity: string): boolean {
  const host = ChessPuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

function isLiveAttempt(state: RoomState): boolean {
  const status = ChessPuzzlePlayAttr.status.from(state);
  return (
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.wrong
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
        reason: `cannot show the solution while status is ${ChessPuzzlePlayAttr.status.from(state)}`,
      },
    };
  }
  if (
    ChessPuzzlePlayAttr.solveIdx.from(state) !==
    ChessPuzzlePlayAttr.furthestSolveIdx.from(state)
  ) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.conflict,
        reason: 'return to the current position before showing the solution',
      },
    };
  }
  const fen = ChessPuzzlePlayAttr.fen.from(state);
  const moves = ChessPuzzlePlayAttr.moves.from(state);
  const solveIdx = puzzleTokensLength(moves);
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
    events: [
      ChessPuzzleSolutionShown({ displayFen, solveIdx, endedAtMs: ctx.ts }),
    ],
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
        reason: `cannot skip while status is ${ChessPuzzlePlayAttr.status.from(state)}`,
      },
    };
  }
  return {
    ok: true,
    events: [ChessPuzzlePlaySkipped({ endedAtMs: ctx.ts })],
  };
}
