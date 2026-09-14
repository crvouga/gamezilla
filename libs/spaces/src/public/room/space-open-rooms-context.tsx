import { useMyDeviceId } from '@libs/auth/public/use-current-user';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
} from 'solid-js';

import { useOpenSpaceSessionIds } from '../../use-cases/list-open-sessions/client/use-open-space-session-ids';
import {
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRoomsPendingClear,
  useSpaceOpenRoomsRegistry,
} from './space-open-rooms-store';
import { clearSpaceOpenSession } from './space-open-session-store';
import { type SpaceRoomUiState, useSpaceRoom } from './use-space-room';

export type {
  SpaceOpenRoomEntry,
  SpaceOpenRoomsRegistrySetter,
} from './space-open-rooms-store';
export {
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRoomEntry,
  useSpaceOpenRooms,
  useSpaceOpenRoomsRegistry,
} from './space-open-rooms-store';

function SpaceOpenRoomSlot(props: { readonly spaceId: string }): null {
  const setEntry = useSpaceOpenRoomsRegistry();
  const clearPending = useSpaceOpenRoomsPendingClear();
  const state: SpaceRoomUiState = useSpaceRoom(props.spaceId);
  const deviceId = useMyDeviceId();

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
    clearPending?.(props.spaceId);
    clearSpaceOpenSession(props.spaceId, deviceId());
  });

  return null;
}

/**
 * Keeps one room WebSocket alive per locally-open space (Meet-style).
 * Close/minimize does not tear down; leave/end deletes the
 * `spaces_open_sessions` row and unmounts that slot.
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
      <For each={mountedIds()}>
        {(spaceId) => <SpaceOpenRoomSlot spaceId={spaceId} />}
      </For>
      {props.children}
    </SpaceOpenRoomsStoreProvider>
  );
}
