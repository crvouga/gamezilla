import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useSpaceRoomDispatch } from '../../../public/room/use-space-room-selector';
import { AnnounceVisibilityChanged } from '../../../shared/space/space-log/space-log-messages';
import type { SpaceVisibility } from '../../../shared/space/space-visibility';
import { setVisibilityMutation } from '../../mutations';

export function useSetVisibility(): (
  spaceId: string,
  visibility: SpaceVisibility
) => Promise<void> {
  const mutationClient = useMutationClient();
  const dispatch = useSpaceRoomDispatch();

  return async (spaceId, visibility) => {
    dispatch(AnnounceVisibilityChanged({ visibility }));
    const result = await mutationClient.mutate(setVisibilityMutation, {
      spaceId,
      visibility,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
