import { useCallback } from 'react';

import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';

import { renameSpaceWrite } from '../../shared/rename-space/rename-space-write';
import { AnnounceRenamed } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useRenameSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  const dispatch = useSpaceRoomDispatch();

  return useCallback(
    async (spaceId: string, title: string) => {
      dispatch(AnnounceRenamed({ title }));
      await runClientWrite(
        renameSpaceWrite,
        writeContext,
        { spaceId, title },
        engine.db
      );
    },
    [dispatch, engine, writeContext]
  );
}
