import { useCallback } from 'react';

import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';

import { endSpaceWrite } from '../../shared/end-space/end-space-write';
import { AnnounceEnded } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useEndSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  const dispatch = useSpaceRoomDispatch();

  return useCallback(
    async (spaceId: string) => {
      dispatch(AnnounceEnded({}));
      await runClientWrite(endSpaceWrite, writeContext, { spaceId }, engine.db);
    },
    [dispatch, engine, writeContext]
  );
}
