import { useMutationClient } from '@libs/auth/public/mutation-client-provider';

import { useMyId } from '@libs/auth/public/use-current-user';
import { useRouter } from '@pkgs/ui';
import { useSpaceOpenRooms } from '../../../public/room/space-open-rooms-context';
import { closeSpaceDetail } from '../../../public/space-routes';
import { AnnounceMemberLeft } from '../../../shared/space/space-log/space-log-messages';
import { LeaveSpaceSeat } from '../../../shared/space/space-members/space-members-messages';
import { leaveSpaceMutation } from '../../mutations';

export function useLeaveSpace() {
  const mutationClient = useMutationClient();
  const { dispatch: dispatchToSpace } = useSpaceOpenRooms();
  const myId = useMyId();
  const router = useRouter();

  return async (spaceId: string) => {
    const member = myId();
    if (member.length > 0) {
      dispatchToSpace(spaceId, LeaveSpaceSeat({ memberId: member }));
      dispatchToSpace(spaceId, AnnounceMemberLeft({ memberId: member }));
    }
    const result = await mutationClient.mutate(leaveSpaceMutation, {
      spaceId,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
    closeSpaceDetail(router);
  };
}
