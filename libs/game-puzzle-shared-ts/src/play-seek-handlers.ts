import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { PUZZLE_PLAY_STATUS, PuzzlePlayAttr } from './play-attr';
import { PuzzlePlayStepped } from './play-messages';
import type { PuzzleGameLookup } from './puzzle-game-lookup';
import { gameInPlay } from './puzzle-game-lookup';
import { type PuzzleGame, positionAt } from './puzzle-setup';
import {
  lineActions,
  nextForwardSolveIdx,
  prevSolveIdx,
  resolveSeekSolveIdx,
} from './step';

function unauthorized(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.unauthorized, reason } };
}

function conflict(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

function internal(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.internal, reason } };
}

function isHostOf(state: RoomState, identity: string): boolean {
  const host = PuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

/** Moving the board along the reached line: back, forward, or to a reached move. */
function assertCanSeekLine(
  state: RoomState,
  identity: string
): HandleResult | null {
  if (!isHostOf(state, identity)) {
    return unauthorized('only the puzzle host may step the puzzle line');
  }
  const status = PuzzlePlayAttr.status.from(state);
  if (
    status !== PUZZLE_PLAY_STATUS.solving &&
    status !== PUZZLE_PLAY_STATUS.solved &&
    status !== PUZZLE_PLAY_STATUS.revealed
  ) {
    return conflict(`cannot step while status is ${status}`);
  }
  return null;
}

function emitSeekToSolveIdx(
  state: RoomState,
  nextIdx: number,
  game: PuzzleGame
): HandleResult {
  const displayFen = positionAt(
    game,
    PuzzlePlayAttr.position.from(state),
    lineActions(PuzzlePlayAttr.line.from(state)),
    nextIdx
  );
  if (displayFen === null) {
    return internal('could not rebuild the position for stepped solve index');
  }
  return {
    ok: true,
    events: [
      PuzzlePlayStepped({
        displayFen,
        solveIdx: nextIdx,
        // Viewing an earlier position never reopens a finished puzzle.
        status: PuzzlePlayAttr.status.from(state),
        layoutKey: PuzzlePlayAttr.layoutKey.from(state) + 1,
      }),
    ],
  };
}

export function handleStepSeek(
  state: RoomState,
  identity: string,
  direction: 'back' | 'forward',
  lookup: PuzzleGameLookup
): HandleResult {
  const denied = assertCanSeekLine(state, identity);
  if (denied !== null) return denied;
  const game = gameInPlay(state, lookup);
  if (game === null) return internal('the puzzle in play names no game');
  const solveIdx = PuzzlePlayAttr.solveIdx.from(state);
  const furthest = PuzzlePlayAttr.furthestSolveIdx.from(state);
  const tokensLength = lineActions(PuzzlePlayAttr.line.from(state)).length;
  const nextIdx =
    direction === 'back'
      ? prevSolveIdx(solveIdx, puzzleLineLayout(game.puzzles).start)
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
  return emitSeekToSolveIdx(state, nextIdx, game);
}

export function handleSeek(
  state: RoomState,
  identity: string,
  targetSolveIdx: number,
  lookup: PuzzleGameLookup
): HandleResult {
  const denied = assertCanSeekLine(state, identity);
  if (denied !== null) return denied;
  const game = gameInPlay(state, lookup);
  if (game === null) return internal('the puzzle in play names no game');
  const nextIdx = resolveSeekSolveIdx({
    solveIdx: PuzzlePlayAttr.solveIdx.from(state),
    furthestSolveIdx: PuzzlePlayAttr.furthestSolveIdx.from(state),
    targetSolveIdx,
    firstSolveIdx: puzzleLineLayout(game.puzzles).start,
  });
  if (nextIdx === null) {
    return conflict('seek target is out of range or already current');
  }
  return emitSeekToSolveIdx(state, nextIdx, game);
}
