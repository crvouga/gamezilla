import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useCallback } from 'react';

import { renameSpaceMutation } from '../../shared/mutations/space-mutations';
import { AnnounceRenamed } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useRenameSpace() {
  const mutationClient = useMutationClient();
  const dispatch = useSpaceRoomDispatch();

  return useCallback(
    async (spaceId: string, title: string) => {
      dispatch(AnnounceRenamed({ title }));
      const result = await mutationClient.mutate(renameSpaceMutation, {
        spaceId,
        title,
      });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [dispatch, mutationClient]
  );
}
