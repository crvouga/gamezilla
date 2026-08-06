import { useCallback } from 'react';

import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';

import { setVisibilityMutation } from '../../shared/mutations/space-mutations';
import { AnnounceVisibilityChanged } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useSetVisibility() {
  const mutationClient = useMutationClient();
  const dispatch = useSpaceRoomDispatch();

  return useCallback(
    async (spaceId: string, visibility: SpaceVisibility) => {
      dispatch(AnnounceVisibilityChanged({ visibility }));
      const result = await mutationClient.mutate(setVisibilityMutation, {
        spaceId,
        visibility,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [dispatch, mutationClient]
  );
}
