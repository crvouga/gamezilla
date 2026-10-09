import { useMyId } from '@libs/auth-client/use-current-user';
import { useSyncedProfiles } from '@libs/profile-client/use-synced-profiles';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared/space-members-messages';
import { isViewingSpaceClient } from '@libs/spaces-shared/space-presence-client-id';
import { useNamedRoomRoster } from '@pkgs/room-root-client/room-clients-context';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import type { RoomActor } from '@pkgs/room-root-shared/types';
import { type Accessor, createMemo } from 'solid-js';
import {
  useSpaceRoomClientId,
  useSpaceRoomSessionId,
} from './space-room-context';
import { SpaceField, useSpaceColumn } from './use-space-column';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from './use-space-room-selector';

/** Current shared presence follows the host; an offline host sees themselves. */
export function useConnectedSpaceRoster(): Accessor<readonly RoomActor[]> {
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const spaceId = useSpaceRoomSessionId();
  // A standalone presence strip has no space identity to hydrate.
  if (spaceId() === null)
    return createMemo(() => (connected() && synced() ? roster() : []));
  const seats = useSpaceRoomSelector(SpaceMembersRoomAttr.seats.from);
  const host = useSpaceColumn(() => spaceId() ?? '', SpaceField.hostMemberId);
  const myId = useMyId();
  const clientId = useSpaceRoomClientId();
  const people = createMemo(() => {
    const hostId = host();
    if (hostId === null) return [];
    if (!connected() || !synced()) {
      const client = clientId();
      return hostId === myId() && client !== null
        ? [{ id: hostId, clientId: client }]
        : [];
    }
    if (!roster().some((actor) => actor.id === hostId)) return [];
    return roster().filter(
      (actor) =>
        isViewingSpaceClient(actor.clientId) &&
        (actor.id === hostId || Object.hasOwn(seats(), actor.id))
    );
  });
  useSyncedProfiles(() => people().map((person) => person.id));
  return people;
}
