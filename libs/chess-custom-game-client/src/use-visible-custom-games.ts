import type { CustomGames } from '@libs/chess-custom-game-shared/custom-game-state';
import { useSpaceHostConnection } from '@libs/spaces-client/use-space-host-connection';
import { useSpaceRoomSelector } from '@libs/spaces-client/use-space-room-selector';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** Keep the received outcome separate from the board the guest was showing. */
export function useVisibleCustomGames(received: Accessor<CustomGames>) {
  const connection = useSpaceHostConnection();
  const engine = useSyncEngine();
  const currentRoom = useSpaceRoomSelector(
    (state) =>
      RoomMetaAttr.isConnected.from(state) && RoomMetaAttr.isSynced.from(state)
  );
  return createMemo<CustomGames>((previous) => {
    const games = received();
    if (
      connection() === 'ready' ||
      (currentRoom() && games.current !== null) ||
      (engine.status().online && games.current?.status === 'cancelled')
    )
      return games;
    return previous?.current === null ? games : (previous ?? games);
  });
}
