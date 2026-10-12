import { useMyId } from '@libs/auth-client/use-current-user';
import { useNamedRoomRoster } from '@pkgs/room-root-client/room-clients-context';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { useSpaceRoomSessionId } from './space-room-context';
import { useConfirmedHostAbsence } from './use-confirmed-host-absence';
import { SpaceField, useSpaceColumn } from './use-space-column';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from './use-space-room-selector';

/** A host uses their local space; guests wait for a current host connection. */
export function useSpaceHostConnection(): Accessor<
  'ready' | 'loading' | 'offline' | 'host-offline'
> {
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const host = useSpaceColumn(() => spaceId() ?? '', SpaceField.hostMemberId);
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const hasRoster = useSpaceRoomSelector(RoomMetaAttr.hasRoster.from);
  const engine = useSyncEngine();
  const absent = createMemo(
    () =>
      connected() &&
      hasRoster() &&
      !roster().some((actor) => actor.id === host())
  );
  const confirmedAbsent = useConfirmedHostAbsence(absent);
  let hostOfflineKnown = false;
  return createMemo(() => {
    const hostId = host();
    if (hostId === null) return 'loading';
    if (hostId === myId()) return 'ready';
    if (!engine.status().online)
      return hostOfflineKnown ? 'host-offline' : 'offline';
    if (!connected() || !hasRoster()) return 'loading';
    // An absence still being confirmed is what this device last saw of the host.
    hostOfflineKnown = absent();
    if (hostOfflineKnown && !confirmedAbsent()) return 'loading';
    if (hostOfflineKnown) return 'host-offline';
    return synced() ? 'ready' : 'loading';
  });
}
