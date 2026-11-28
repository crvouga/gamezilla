import { GameSessionsAttr } from '@libs/game-session-shared-ts/game-session-state';
import {
  gameSessionSeatsNote,
  noteGameSessionSeatsMutation,
} from '@libs/game-session-sub-shared-ts/game-session-seats';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { createEffect } from 'solid-js';

/**
 * A device in the space notes who sits in its room's game session, once per
 * change it sees, so every device of each person seated in it knows there
 * is a game session to return to (the seat index). The server
 * keeps a note only when the room agrees, so a late one changes nothing.
 */
export function GameSessionSeatsNote(): null {
  const games = useSpaceRoomSelector(GameSessionsAttr.from);
  const spaceId = useSpaceRoomSessionId();
  const synced = useSpaceRoomSelector(
    (s) => RoomMetaAttr.isConnected.from(s) && RoomMetaAttr.isSynced.from(s)
  );
  const sync = useSyncEngine();
  const client = useMutationClient();
  let noted = '';
  createEffect(
    () => {
      const id = spaceId();
      if (!id || !synced() || !sync.status().online) return null;
      return gameSessionSeatsNote(id, games());
    },
    (note) => {
      if (note === null) return;
      const key = JSON.stringify(note);
      if (key === noted) return;
      noted = key;
      void client.mutate(noteGameSessionSeatsMutation, note);
    }
  );
  return null;
}
