import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { PUZZLE_PLAY_STATUS, PuzzlePlayAttr } from './play-attr';
import {
  PuzzleMoveRecommended,
  PuzzleRecommendationCleared,
} from './play-messages';
import type { PuzzleGame } from './puzzle-setup';

function conflict(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

/**
 * Any room member may suggest a move for the live position. Suggestions are
 * annotations: they never advance the puzzle and never depend on host rights.
 * A suggestion names two cells of the puzzle's board (`isCell`).
 */
export function handleRecommend(
  state: RoomState,
  identity: string,
  payload: { from: string; to: string },
  game: PuzzleGame | null
): HandleResult {
  if (
    game !== null &&
    (!game.puzzles.isCell(payload.from) || !game.puzzles.isCell(payload.to))
  ) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'a suggestion names two cells of the board',
      },
    };
  }
  const status = PuzzlePlayAttr.status.from(state);
  if (status !== PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot suggest a move while status is ${status}`);
  }
  return {
    ok: true,
    events: [
      PuzzleMoveRecommended({
        by: identity,
        from: payload.from,
        to: payload.to,
      }),
    ],
  };
}

/** A member withdraws their own suggestion. */
export function handleClearRecommendation(
  state: RoomState,
  identity: string
): HandleResult {
  if (PuzzlePlayAttr.recommendations.from(state)[identity] === undefined) {
    return conflict('caller has no suggestion to clear');
  }
  return {
    ok: true,
    events: [PuzzleRecommendationCleared({ by: identity })],
  };
}
