import { useMyId } from '@libs/auth/client/use-current-user';
import { RoomMetaAttr } from '@pkgs/room';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useEffect, useRef } from 'react';

import { markSpaceSessionJoinAnnounced } from '../../shared/open-space/space-open-session-write';
import { JoinSpaceSeat } from '../../shared/space-members/space-members-messages';
import { AnnounceMemberJoined } from '../../shared/space-log/space-log-messages';
import { useSpaceOpenSession } from '../open-space/use-open-space-session-ids';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

/**
 * Once per open-space session (after the room first syncs), take a seat and
 * announce join for the collaborative event log.
 */
export function useAnnounceJoinedOnSync(spaceId: string): void {
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const session = useSpaceOpenSession(spaceId);
  const engine = useSyncEngine();
  const announcingRef = useRef(false);

  useEffect(() => {
    if (!synced || myId.length === 0 || spaceId.length === 0) return;
    if (!session.isOpen || session.joinAnnounced) return;
    if (announcingRef.current) return;
    announcingRef.current = true;
    void engine.db
      .transaction(async (tx) => markSpaceSessionJoinAnnounced(tx, spaceId))
      .then((didMark) => {
        if (!didMark) return;
        dispatch(JoinSpaceSeat({ memberId: myId }));
        dispatch(AnnounceMemberJoined({ memberId: myId }));
      })
      .finally(() => {
        announcingRef.current = false;
      });
  }, [
    synced,
    myId,
    spaceId,
    dispatch,
    engine,
    session.isOpen,
    session.joinAnnounced,
  ]);
}
