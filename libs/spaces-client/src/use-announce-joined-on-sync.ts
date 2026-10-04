import { useMyId } from '@libs/auth-client/use-current-user';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { RoomMetaAttr } from '@pkgs/room-client/room-meta';
import { createEffect } from 'solid-js';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';
import { AnnounceMemberJoined } from '@libs/spaces-shared/space-log-messages';
import { useSpaceOpenSession } from './use-open-space-session-ids';
import { markSpaceJoinAnnouncedMutation } from '@libs/spaces-shared/mark-join-announced-mutation';

function dispatchJoinAnnounce(
  dispatch: ReturnType<typeof useSpaceRoomDispatch>,
  memberId: string
): void {
  dispatch(AnnounceMemberJoined({ memberId }));
}

/**
 * Once per open-space session (after the room first syncs), announce join for the collaborative event log. Hosts that created the space
 * already have join_announced=1 — only room commands run. Joiners persist the
 * flag via markSpaceJoinAnnounced first.
 */
export function useAnnounceJoinedOnSync(spaceId: string): void {
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const session = useSpaceOpenSession(spaceId);
  const mutationClient = useMutationClient();
  const announcedSpaceRef = { current: null as string | null };
  const mutatingRef = { current: false };

  createEffect(() => {
    if (!synced() || myId().length === 0 || spaceId.length === 0) return;
    if (!session.isOpen()) return;
    if (announcedSpaceRef.current === spaceId) return;

    if (session.joinAnnounced()) {
      announcedSpaceRef.current = spaceId;
      dispatchJoinAnnounce(dispatch, myId());
      return;
    }

    if (mutatingRef.current) return;
    mutatingRef.current = true;
    void mutationClient
      .mutate(markSpaceJoinAnnouncedMutation, { spaceId })
      .then((result) => {
        if (!result.ok) return;
        announcedSpaceRef.current = spaceId;
        dispatchJoinAnnounce(dispatch, myId());
      })
      .finally(() => {
        mutatingRef.current = false;
      });
  });
}
