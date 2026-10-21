import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { useNamedRoomRoster } from '@pkgs/room-root-client-ts/room-clients-context';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import { useSpaceRoomSessionId } from './space-room-context';
import { useConfirmedHostAbsence } from './use-confirmed-host-absence';
import { SpaceField, useSpaceColumn } from './use-space-column';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from './use-space-room-selector';

type HostLink = 'ready' | 'loading' | 'offline' | 'host-offline';

/**
 * Guest link while this device or the room socket is down. Null when the
 * room is live. A socket drop is loading until it is confirmed, so a removed
 * person can reconnect and join again while the host is still there.
 */
function guestLinkWhileDark(args: {
  online: boolean;
  inRoom: boolean;
  hostWasGone: boolean;
  dropConfirmed: boolean;
}): HostLink | null {
  if (!args.online) return args.hostWasGone ? 'host-offline' : 'offline';
  if (args.inRoom) return null;
  return args.dropConfirmed || args.hostWasGone ? 'host-offline' : 'loading';
}

/** A host uses their local space; guests wait for a current host connection. */
export function useSpaceHostConnection(): Accessor<HostLink> {
  const myId = useMyId();
  const spaceId = useSpaceRoomSessionId();
  const host = useSpaceColumn(() => spaceId() ?? '', SpaceField.hostMemberId);
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const hasRoster = useSpaceRoomSelector(RoomMetaAttr.hasRoster.from);
  const engine = useSyncEngine();
  const inRoom = createMemo(() => connected() && hasRoster());
  const absent = createMemo(
    () => inRoom() && !roster().some((actor) => actor.id === host())
  );
  const confirmedAbsent = useConfirmedHostAbsence(absent);
  const [sawHost, setSawHost] = createSignal(false);
  const dropConfirmed = useConfirmedHostAbsence(
    () => sawHost() && engine.status().online && !inRoom()
  );
  let hostOfflineKnown = false;
  createEffect(() => {
    if (inRoom() && !absent()) setSawHost(true);
  });
  return createMemo(() => {
    const hostId = host();
    if (hostId === null) return 'loading';
    if (hostId === myId()) return 'ready';
    const dark = guestLinkWhileDark({
      online: engine.status().online,
      inRoom: inRoom(),
      hostWasGone: hostOfflineKnown,
      dropConfirmed: dropConfirmed(),
    });
    if (dark !== null) return dark;
    // An absence still being confirmed is what this device last saw of the host.
    hostOfflineKnown = absent();
    if (hostOfflineKnown && !confirmedAbsent()) return 'loading';
    if (hostOfflineKnown) return 'host-offline';
    return synced() ? 'ready' : 'loading';
  });
}
