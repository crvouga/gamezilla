import { useEffect, useRef } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';
import { RoomMetaAttr } from '@pkgs/room';

import { JoinSpaceSeat } from '../../shared/space-members/space-members-messages';
import { AnnounceMemberJoined } from '../../shared/space-log/space-log-messages';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '../room/use-space-room-selector';

/**
 * Once per space session (after the room first syncs), take a seat and
 * announce join for the collaborative event log.
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
    dispatch(JoinSpaceSeat({ memberId: myId }));
    dispatch(AnnounceMemberJoined({ memberId: myId }));
  }, [synced, myId, spaceId, dispatch]);
}
