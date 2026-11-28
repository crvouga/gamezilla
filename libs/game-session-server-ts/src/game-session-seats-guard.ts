import { GameSessionsAttr } from '@libs/game-session-shared-ts/game-session-state';
import {
  gameSessionSeatsNoteHolds,
  noteGameSessionSeatsArgs,
  noteGameSessionSeatsMutation,
} from '@libs/game-session-sub-shared-ts/game-session-seats';
import { spaceRoomTopic } from '@libs/spaces-shared-ts/space-room-topic';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';

/**
 * A device notes who sits in its space's game session; the game sessions live
 * in the space's room, which only the server reads, so the replay keeps a
 * note only when the room says the same.
 */
export function gameSessionSeatsGuard(
  rooms: Pick<RoomServicePort, 'read'>
): MutationAuthorize {
  return async (ctx) => {
    if (ctx.name !== noteGameSessionSeatsMutation.name) return;
    const note = noteGameSessionSeatsArgs.parse(ctx.args);
    const games = GameSessionsAttr.from(
      await rooms.read(spaceRoomTopic(note.spaceId))
    );
    if (!gameSessionSeatsNoteHolds(note, games))
      throw new MutationError(
        'GAME_SESSION_SEATS_STALE',
        'The space has moved on from that game session.'
      );
  };
}
