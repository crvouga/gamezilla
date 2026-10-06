import { renameSpaceMutation } from '@libs/spaces-shared/rename-space-mutation';
import { AnnounceRenamed } from '@libs/spaces-shared/space-log-messages';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useSpaceRoomDispatch } from './use-space-room-selector';

export function useRenameSpace() {
  const mutationClient = useMutationClient();
  const dispatch = useSpaceRoomDispatch();

  return async (spaceId: string, title: string) => {
    const result = await mutationClient.mutate(renameSpaceMutation, {
      spaceId,
      title,
    });
    if (!result.ok) throw new Error(result.failures[0]?.message);
    // Announce only a name that was saved: a refused name never reaches the
    // space, and clearing the name (back to the host's) announces nothing.
    const saved = title.trim();
    if (saved.length > 0) dispatch(AnnounceRenamed({ title: saved }));
  };
}
