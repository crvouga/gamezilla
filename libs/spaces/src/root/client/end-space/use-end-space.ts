import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useCallback } from 'react';
import { useSpaceOpenRooms } from '../../../public/room/space-open-rooms-context';
import { AnnounceEnded } from '../../../shared/space/space-log/space-log-messages';
import { endSpaceMutation } from '../../mutations';

export function useEndSpace() {
  const mutationClient = useMutationClient();
  const { dispatch } = useSpaceOpenRooms();

  return useCallback(
    async (spaceId: string) => {
      dispatch(spaceId, AnnounceEnded({}));
      const result = await mutationClient.mutate(endSpaceMutation, { spaceId });
      if (!result.ok) throw new Error(result.failures[0]?.message);
    },
    [dispatch, mutationClient]
  );
}
