import { useMyDeviceId } from '@libs/auth-client/use-current-user';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

import { useOpenSpaceSessionIds } from './use-open-space-session-ids';
import {
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRooms,
  useSpaceOpenRoomsPendingClear,
  useSpaceOpenRoomsRegistry,
} from './space-open-rooms-store';
import type { SpaceRoomUiState } from './use-space-room';
import { useSpaceRoom } from './use-space-room';

function SpaceOpenRoomSlot(props: { readonly spaceId: string }): null {
  const setEntry = useSpaceOpenRoomsRegistry();
  const state: SpaceRoomUiState = useSpaceRoom(props.spaceId);

  createEffect(() => {
    const room = state.room;
    if (room === null) {
      // Keep any buffered commands — Room may still be hydrating locally.
      setEntry(props.spaceId, null);
      return;
    }
    setEntry(props.spaceId, { room, clientId: state.clientId });
  });

  onCleanup(() => {
    setEntry(props.spaceId, null);
  });

  return null;
}

/**
 * A person is present in the space they are viewing. Stepping out suspends
 * its connection but keeps membership, saved commands and the open-session
 * identity, so returning catches up without joining twice.
 */
export function SpaceOpenRoomsProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const sessions = useOpenSpaceSessionIds();
  const [stableIds, setStableIds] = createSignal<readonly string[]>([]);
  createEffect(() => {
    if (!sessions.isLoading()) setStableIds(sessions.spaceIds());
  });
  // While the open-session query is loading, keep prior ids mounted and also
  // include any ids already present in `spaceIds` so an optimistic create
  // cannot unmount a brand-new room slot (which stuck the event log on
  // "Connecting…" / "Reconnecting…" with no WebSocket).
  const mountedIds = createMemo(() => {
    if (sessions.isLoading()) {
      return Array.from(new Set([...stableIds(), ...sessions.spaceIds()]));
    }
    return sessions.spaceIds();
  });

  return (
    <SpaceOpenRoomsStoreProvider>
      <SpaceOpenRoomSlots spaceIds={mountedIds()} />
      {props.children}
    </SpaceOpenRoomsStoreProvider>
  );
}

function SpaceOpenRoomSlots(props: {
  readonly spaceIds: readonly string[];
}): JSX.Element {
  const rooms = useSpaceOpenRooms();
  const clearPending = useSpaceOpenRoomsPendingClear();
  const deviceId = useMyDeviceId();
  let previousIds = new Set<string>();
  createEffect(() => {
    const currentIds = new Set(props.spaceIds);
    for (const spaceId of previousIds) {
      if (currentIds.has(spaceId)) continue;
      clearPending?.(spaceId);
      rooms.clearClientId(spaceId, deviceId());
    }
    previousIds = currentIds;
  });
  return (
    <For each={props.spaceIds}>
      {(spaceId) => (
        <Show when={rooms.viewingIds().has(spaceId)}>
          <SpaceOpenRoomSlot spaceId={spaceId} />
        </Show>
      )}
    </For>
  );
}
