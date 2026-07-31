import { useEffect } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';
import { RoomMetaAttr } from '@pkgs/room';

import { JoinSpaceSeat } from '../../shared/space-members/space-members-messages';
import { AnnounceMemberJoined } from '../../shared/space-log/space-log-messages';
import {
  hasAnnouncedSpaceJoin,
  markAnnouncedSpaceJoin,
} from './space-open-session-store';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

/**
 * Once per open-space session (after the room first syncs), take a seat and
 * announce join for the collaborative event log. Survives detail remounts;
 * cleared when the space leaves the local open set.
 */
export function useAnnounceJoinedOnSync(spaceId: string): void {
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);

  useEffect(() => {
    if (!synced || myId.length === 0 || spaceId.length === 0) return;
    if (hasAnnouncedSpaceJoin(spaceId)) return;
    markAnnouncedSpaceJoin(spaceId);
    dispatch(JoinSpaceSeat({ memberId: myId }));
    dispatch(AnnounceMemberJoined({ memberId: myId }));
  }, [synced, myId, spaceId, dispatch]);
}
