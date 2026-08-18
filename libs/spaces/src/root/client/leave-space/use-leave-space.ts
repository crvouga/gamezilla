import { useMutationClient } from '@libs/auth/public/mutation-client-provider';

import { useMyId } from '@libs/auth/public/use-current-user';
import { useCallback } from 'react';
import { useSpaceOpenRooms } from '../../../public/room/space-open-rooms-context';
import { AnnounceMemberLeft } from '../../../shared/space/space-log/space-log-messages';
import {
  LeaveSpaceSeat,
  SpaceMembersRoomAttr,
} from '../../../shared/space/space-members/space-members-messages';
import { leaveSpaceMutation } from '../../mutations';

export function useLeaveSpace() {
  const mutationClient = useMutationClient();
  const { dispatch: dispatchToSpace, getEntry } = useSpaceOpenRooms();
  const myId = useMyId();

  return useCallback(
    async (spaceId: string) => {
      const entry = getEntry(spaceId);
      const seats =
        entry === null
          ? {}
          : SpaceMembersRoomAttr.seats.from(entry.room.getSnapshot());
      const seatIds = Object.keys(seats);
      const endIfLastSeat =
        seatIds.includes(myId) && seatIds.every((id) => id === myId);
      if (myId.length > 0) {
        dispatchToSpace(spaceId, LeaveSpaceSeat({ memberId: myId }));
        dispatchToSpace(spaceId, AnnounceMemberLeft({ memberId: myId }));
      }
      const result = await mutationClient.mutate(leaveSpaceMutation, {
        spaceId,
        endIfLastSeat,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [dispatchToSpace, getEntry, mutationClient, myId]
  );
}
