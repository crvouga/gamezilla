import type { GameCommandContext } from '@libs/spaces/public/game';
import { type HandleResult, ROOM_ERROR_TYPE, type RoomState } from '@pkgs/room';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
} from './chess-puzzle-play-attr';
import { ChessPuzzlePlaySkipped } from './chess-puzzle-play-messages';

function isHostOf(state: RoomState, identity: string): boolean {
  const host = ChessPuzzlePlayAttr.hostIdentity.from(state);
  return host !== null && host === identity;
}

/** Host abandons the live attempt without solving it (terminal, unrated). */
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
  const status = ChessPuzzlePlayAttr.status.from(state);
  if (
    status !== CHESS_PUZZLE_PLAY_STATUS.solving &&
    status !== CHESS_PUZZLE_PLAY_STATUS.wrong
  ) {
    return {
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.conflict,
        reason: `cannot skip while status is ${status}`,
      },
    };
  }
  return {
    ok: true,
    events: [ChessPuzzlePlaySkipped({ endedAtMs: ctx.ts })],
  };
}
