import { useMyDeviceId, useMyId } from '@libs/auth-client/use-current-user';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import {
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRooms,
  useSpaceOpenRoomsPendingClear,
  useSpaceOpenRoomsRegistry,
} from './space-open-rooms-store';
import { useOpenSpaceSessionIds } from './use-open-space-session-ids';
import { SpaceField, useSpaceColumn } from './use-space-column';
import { useSpaceJoinSnapshot } from './use-space-join-snapshot';
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
 * A person is present in the space they are viewing. A host stays available
 * while their app is online, including in the lobby. Guests stepping out
 * suspend their connection while keeping membership and saved commands.
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
  const viewedIds = createMemo(() =>
    Array.from(new Set([...props.spaceIds, ...rooms.viewingIds()]))
  );
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
    <For each={viewedIds()}>
      {(spaceId) => (
        <SpaceRoomCandidate
          spaceId={spaceId}
          isOpen={props.spaceIds.includes(spaceId)}
        />
      )}
    </For>
  );
}

/** A public link can observe availability before joining, without taking a seat. */
function SpaceRoomCandidate(props: {
  readonly spaceId: string;
  readonly isOpen: boolean;
}): JSX.Element {
  const rooms = useSpaceOpenRooms();
  const myId = useMyId();
  const host = useSpaceColumn(() => props.spaceId, SpaceField.hostMemberId);
  const preview = useSpaceJoinSnapshot(
    () => props.spaceId,
    () => true
  );
  return (
    <Show
      when={
        (props.isOpen && host() === myId()) ||
        (rooms.viewingIds().has(props.spaceId) &&
          (props.isOpen || (preview().status === 'live' && preview().joinable)))
      }
    >
      <Show
        when={props.isOpen}
        fallback={<SpaceOpenRoomSlot spaceId={props.spaceId} />}
      >
        <SpaceOpenRoomSlot spaceId={props.spaceId} />
      </Show>
    </Show>
  );
}
