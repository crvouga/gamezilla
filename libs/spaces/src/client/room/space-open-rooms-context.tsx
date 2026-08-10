import { type ReactNode, useEffect, useRef } from 'react';

import { useOpenSpaceSessionIds } from '../open-space/use-open-space-session-ids';
import {
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRoomsPendingClear,
  useSpaceOpenRoomsRegistry,
} from './space-open-rooms-store';
import { clearSpaceOpenSession } from './space-open-session-store';
import { useSpaceRoom } from './use-space-room';

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

function SpaceOpenRoomSlot({ spaceId }: { readonly spaceId: string }): null {
  const setEntry = useSpaceOpenRoomsRegistry();
  const clearPending = useSpaceOpenRoomsPendingClear();
  const state = useSpaceRoom(spaceId);

  useEffect(() => {
    if (state.room === null) {
      // Keep any buffered commands — Room may still be hydrating locally.
      setEntry(spaceId, null);
      return;
    }
    setEntry(spaceId, { room: state.room, clientId: state.clientId });
    return () => {
      setEntry(spaceId, null);
    };
  }, [setEntry, spaceId, state.room, state.clientId]);

  useEffect(() => {
    return () => {
      clearPending?.(spaceId);
      clearSpaceOpenSession(spaceId);
    };
  }, [spaceId, clearPending]);

  return null;
}

/**
 * Keeps one room WebSocket alive per locally-open space (Meet-style).
 * Close/minimize does not tear down; leave/end deletes the
 * `spaces_open_sessions` row and unmounts that slot.
 */
export function SpaceOpenRoomsProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { spaceIds, isLoading } = useOpenSpaceSessionIds();
  const stableIdsRef = useRef<readonly string[]>([]);
  if (!isLoading) {
    stableIdsRef.current = spaceIds;
  }
  // While the open-session query is loading, keep prior ids mounted and also
  // include any ids already present in `spaceIds` so an optimistic create
  // cannot unmount a brand-new room slot (which stuck the event log on
  // "Connecting…" / "Reconnecting…" with no WebSocket).
  const mountedIds = isLoading
    ? Array.from(new Set([...stableIdsRef.current, ...spaceIds]))
    : spaceIds;

  return (
    <SpaceOpenRoomsStoreProvider>
      {mountedIds.map((spaceId) => (
        <SpaceOpenRoomSlot key={spaceId} spaceId={spaceId} />
      ))}
      {children}
    </SpaceOpenRoomsStoreProvider>
  );
}
