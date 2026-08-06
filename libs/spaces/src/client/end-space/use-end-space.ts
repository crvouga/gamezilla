import { useCallback } from 'react';

import { useMutationClient } from '@libs/auth/client/mutation-client-provider';

import { endSpaceMutation } from '../../shared/mutations/space-mutations';
import { AnnounceEnded } from '../../shared/space-log/space-log-messages';
import { useSpaceOpenRooms } from '../room/space-open-rooms-context';

export function useEndSpace() {
  const mutationClient = useMutationClient();
  const { dispatch: dispatchToSpace } = useSpaceOpenRooms();

  return useCallback(
    async (spaceId: string) => {
      dispatchToSpace(spaceId, AnnounceEnded({}));
      const result = await mutationClient.mutate(endSpaceMutation, { spaceId });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [dispatchToSpace, mutationClient]
  );
}
