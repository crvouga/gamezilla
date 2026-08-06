import { useMyId } from '@libs/auth/client/use-current-user';
import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { RoomMetaAttr } from '@pkgs/room';
import { useEffect, useRef } from 'react';

import { markSpaceJoinAnnouncedMutation } from '../../shared/mutations/space-mutations';
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
  const mutationClient = useMutationClient();
  const announcingRef = useRef(false);

  useEffect(() => {
    if (!synced || myId.length === 0 || spaceId.length === 0) return;
    if (!session.isOpen || session.joinAnnounced) return;
    if (announcingRef.current) return;
    announcingRef.current = true;
    void mutationClient
      .mutate(markSpaceJoinAnnouncedMutation, { spaceId })
      .then((result) => {
        if (!result.ok) return;
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
    mutationClient,
    session.isOpen,
    session.joinAnnounced,
  ]);
}
