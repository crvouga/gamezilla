import {
  customGameSeatsNote,
  noteCustomGameSeatsMutation,
} from '@libs/game-session-shared-ts/custom-game-seats';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { createEffect } from 'solid-js';

/**
 * A device in the space notes who sits in its room's custom game, once per
 * change it sees, so every device of each person seated in it knows there
 * is a custom game to return to (`chess_custom_game_seats`). The server
 * keeps a note only when the room agrees, so a late one changes nothing.
 */
export function CustomGameSeatsNote(): null {
  const games = useSpaceRoomSelector(CustomGamesAttr.from);
  const spaceId = useSpaceRoomSessionId();
  const synced = useSpaceRoomSelector(
    (s) => RoomMetaAttr.isConnected.from(s) && RoomMetaAttr.isSynced.from(s)
  );
  const sync = useSyncEngine();
  const client = useMutationClient();
  let noted = '';
  createEffect(() => {
    const id = spaceId();
    if (!id || !synced() || !sync.status().online) return;
    const note = customGameSeatsNote(id, games());
    if (note === null) return;
    const key = JSON.stringify(note);
    if (key === noted) return;
    noted = key;
    void client.mutate(noteCustomGameSeatsMutation, note);
  });
  return null;
}
