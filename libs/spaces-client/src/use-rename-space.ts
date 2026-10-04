import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useSpaceRoomDispatch } from './use-space-room-selector';
import { AnnounceRenamed } from '@libs/spaces-shared/space-log-messages';
import { renameSpaceMutation } from '@libs/spaces-shared/rename-space-mutation';

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
