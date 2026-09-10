import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useSpaceRoomDispatch } from '../../../public/room/use-space-room-selector';
import { AnnounceRenamed } from '../../../shared/space/space-log/space-log-messages';
import { renameSpaceMutation } from '../../mutations';

export function useRenameSpace() {
  const mutationClient = useMutationClient();
  const dispatch = useSpaceRoomDispatch();

  return async (spaceId: string, title: string) => {
    dispatch(AnnounceRenamed({ title }));
    const result = await mutationClient.mutate(renameSpaceMutation, {
      spaceId,
      title,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
  };
}
