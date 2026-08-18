import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useMyId } from '@libs/auth/client/use-current-user';
import { RoomMetaAttr } from '@pkgs/room';
import { useEffect, useRef } from 'react';

import { markSpaceJoinAnnouncedMutation } from '../../shared/mutations/space-mutations';
import { AnnounceMemberJoined } from '../../shared/space-log/space-log-messages';
import { JoinSpaceSeat } from '../../shared/space-members/space-members-messages';
import { useSpaceOpenSession } from '../open-space/use-open-space-session-ids';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

function dispatchJoinAnnounce(
  dispatch: ReturnType<typeof useSpaceRoomDispatch>,
  memberId: string
): void {
  dispatch(JoinSpaceSeat({ memberId }));
  dispatch(AnnounceMemberJoined({ memberId }));
}

/**
 * Once per open-space session (after the room first syncs), take a seat and
 * announce join for the collaborative event log. Hosts that created the space
 * already have join_announced=1 — only room commands run. Joiners persist the
 * flag via markSpaceJoinAnnounced first.
 */
export function useAnnounceJoinedOnSync(spaceId: string): void {
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const session = useSpaceOpenSession(spaceId);
  const mutationClient = useMutationClient();
  const announcedSpaceRef = useRef<string | null>(null);
  const mutatingRef = useRef(false);

  useEffect(() => {
    if (!synced || myId.length === 0 || spaceId.length === 0) return;
    if (!session.isOpen) return;
    if (announcedSpaceRef.current === spaceId) return;

    if (session.joinAnnounced) {
      announcedSpaceRef.current = spaceId;
      dispatchJoinAnnounce(dispatch, myId);
      return;
    }

    if (mutatingRef.current) return;
    mutatingRef.current = true;
    void mutationClient
      .mutate(markSpaceJoinAnnouncedMutation, { spaceId })
      .then((result) => {
        if (!result.ok) return;
        announcedSpaceRef.current = spaceId;
        dispatchJoinAnnounce(dispatch, myId);
      })
      .finally(() => {
        mutatingRef.current = false;
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
