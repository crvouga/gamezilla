import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import type { MatchRoomGame } from '@libs/game-matchmaking-shared-ts/match-room';

/** A room can provide live metadata only for the game currently displayed. */
export function matchingMultiplayerRoomGame(
  current: Pick<MultiplayerGame, 'id' | 'revision'> | null,
  room: MatchRoomGame | null
): MatchRoomGame | null {
  return current !== null &&
    room !== null &&
    room.id === current.id &&
    room.revision >= current.revision
    ? room
    : null;
}
