import { type RoomActor, RoomMetaAttr } from '@pkgs/room';
import { useNamedRoomRoster } from '@pkgs/room/solid';
import { type Accessor, createMemo } from 'solid-js';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from './use-space-room-selector';

/** Presence is current only while this device has a caught-up connection. */
export function useConnectedSpaceRoster(): Accessor<readonly RoomActor[]> {
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  return createMemo(() => (connected() && synced() ? roster() : []));
}
