import { SPACE_ROOM_MODULE_NAME } from '@libs/spaces-shared/space-room-module-name';
import { RoomClientsProvider } from '@pkgs/room-root-client/room-clients-context';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { useGamesRegistry } from './games-registry-context';
import { useSpaceOpenRoomEntries } from './space-open-rooms-store';

export function SpaceGameSessionEffects(): JSX.Element {
  const rooms = useSpaceOpenRoomEntries();
  const games = useGamesRegistry();
  const entries = createMemo(() => [...rooms().values()]);
  return (
    <For each={entries()}>
      {(entry) => (
        <RoomClientsProvider
          rooms={new Map([[SPACE_ROOM_MODULE_NAME, entry.room]])}
        >
          <For each={games}>
            {(game) => (
              <Show when={game.SessionEffects} keyed>
                {(Effects) => <Effects />}
              </Show>
            )}
          </For>
        </RoomClientsProvider>
      )}
    </For>
  );
}
