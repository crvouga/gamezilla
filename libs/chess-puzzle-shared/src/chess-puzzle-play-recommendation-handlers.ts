import type { Square } from '@pkgs/chess-board-core-shared/types';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
} from './chess-puzzle-play-attr';
import {
  ChessPuzzleMoveRecommended,
  ChessPuzzleRecommendationCleared,
} from './chess-puzzle-play-messages';

function conflict(reason: string): HandleResult {
  return { ok: false, error: { type: ROOM_ERROR_TYPE.conflict, reason } };
}

/**
 * Any room member may suggest a move for the live position. Suggestions are
 * annotations: they never advance the puzzle and never depend on host rights.
 */
export function handleRecommend(
  state: RoomState,
  identity: string,
  payload: { from: Square; to: Square }
): HandleResult {
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (status !== CHESS_PUZZLE_PLAY_STATUS.solving) {
    return conflict(`cannot suggest a move while status is ${status}`);
  }
  return {
    ok: true,
    events: [
      ChessPuzzleMoveRecommended({
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
  if (ChessPuzzlePlayAttr.recommendations.from(state)[identity] === undefined) {
    return conflict('caller has no suggestion to clear');
  }
  return {
    ok: true,
    events: [ChessPuzzleRecommendationCleared({ by: identity })],
  };
}
