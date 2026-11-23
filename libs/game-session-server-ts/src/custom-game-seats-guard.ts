import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import {
  customGameSeatsNoteHolds,
  noteCustomGameSeatsArgs,
  noteCustomGameSeatsMutation,
} from '@libs/game-session-sub-shared-ts/custom-game-seats';
import { spaceRoomTopic } from '@libs/spaces-shared-ts/space-room-topic';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';

/**
 * A device notes who sits in its space's custom game; the custom games live
 * in the space's room, which only the server reads, so the replay keeps a
 * note only when the room says the same.
 */
export function customGameSeatsGuard(
  rooms: Pick<RoomServicePort, 'read'>
): MutationAuthorize {
  return async (ctx) => {
    if (ctx.name !== noteCustomGameSeatsMutation.name) return;
    const note = noteCustomGameSeatsArgs.parse(ctx.args);
    const games = CustomGamesAttr.from(
      await rooms.read(spaceRoomTopic(note.spaceId))
    );
    if (!customGameSeatsNoteHolds(note, games))
      throw new MutationError(
        'CUSTOM_GAME_SEATS_STALE',
        'The space has moved on from that custom game.'
      );
  };
}
