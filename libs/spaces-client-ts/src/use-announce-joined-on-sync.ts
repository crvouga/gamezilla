import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { markSpaceJoinAnnouncedMutation } from '@libs/spaces-shared-ts/mark-join-announced-mutation';
import { AnnounceMemberJoined } from '@libs/spaces-shared-ts/space-log-messages';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { type Accessor, createEffect } from 'solid-js';
import { useSpaceOpenSession } from './use-open-space-session-ids';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

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
export function useAnnounceJoinedOnSync(spaceId: Accessor<string>): void {
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const session = useSpaceOpenSession(spaceId);
  const mutationClient = useMutationClient();
  const announcedSpaceRef = { current: null as string | null };
  const mutatingRef = { current: false };

  const persistThenAnnounce = (id: string): void => {
    if (mutatingRef.current) return;
    mutatingRef.current = true;
    void mutationClient
      .mutate(markSpaceJoinAnnouncedMutation, { spaceId: id })
      .then((result) => {
        if (!result.ok) return;
        // The optimistic row can trigger the effect before upload resolves.
        if (announcedSpaceRef.current === id) return;
        announcedSpaceRef.current = id;
        dispatchJoinAnnounce(dispatch, myId());
      })
      .finally(() => {
        mutatingRef.current = false;
      });
  };

  createEffect(
    () => {
      const id = spaceId();
      const me = myId();
      if (!synced() || me.length === 0 || id.length === 0) return null;
      if (!session.isOpen()) return null;
      return { id, me, announced: session.joinAnnounced() };
    },
    (due) => {
      if (due === null || announcedSpaceRef.current === due.id) return;
      if (!due.announced) {
        persistThenAnnounce(due.id);
        return;
      }
      announcedSpaceRef.current = due.id;
      dispatchJoinAnnounce(dispatch, due.me);
    }
  );
}
