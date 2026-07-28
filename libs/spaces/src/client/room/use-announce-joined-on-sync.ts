import { useEffect, useRef } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';
import { RoomMetaAttr } from '@pkgs/room';

import { AnnounceMemberJoined } from '../../shared/space-log/space-log-messages';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '../room/use-space-room-selector';

/**
 * Once per space session (after the room first syncs), announce that this
 * member joined so the collaborative event log records the entry.
 * Join itself happens via PowerSync before the room opens, so this cannot
 * live inside {@link useJoinSpace}.
 */
export function useAnnounceJoinedOnSync(spaceId: string): void {
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const announcedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!synced || myId.length === 0 || spaceId.length === 0) return;
    if (announcedFor.current === spaceId) return;
    announcedFor.current = spaceId;
    dispatch(AnnounceMemberJoined({ memberId: myId }));
  }, [synced, myId, spaceId, dispatch]);
}
