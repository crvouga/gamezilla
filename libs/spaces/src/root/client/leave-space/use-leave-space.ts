import { useMutationClient } from '@libs/auth/public/mutation-client-provider';

import { useMyId } from '@libs/auth/public/use-current-user';
import { useCallback } from 'react';
import { useSpaceOpenRooms } from '../../../public/room/space-open-rooms-context';
import { AnnounceMemberLeft } from '../../../shared/space/space-log/space-log-messages';
import { LeaveSpaceSeat } from '../../../shared/space/space-members/space-members-messages';
import { leaveSpaceMutation } from '../../mutations';

export function useLeaveSpace() {
  const mutationClient = useMutationClient();
  const { dispatch: dispatchToSpace } = useSpaceOpenRooms();
  const myId = useMyId();

  return useCallback(
    async (spaceId: string) => {
      if (myId.length > 0) {
        dispatchToSpace(spaceId, LeaveSpaceSeat({ memberId: myId }));
        dispatchToSpace(spaceId, AnnounceMemberLeft({ memberId: myId }));
      }
      const result = await mutationClient.mutate(leaveSpaceMutation, {
        spaceId,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [dispatchToSpace, mutationClient, myId]
  );
}
