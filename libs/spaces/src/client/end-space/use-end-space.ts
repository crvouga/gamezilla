import { useCallback } from 'react';

import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';

import { endSpaceWrite } from '../../shared/end-space/end-space-write';
import { AnnounceEnded } from '../../shared/space-log/space-log-messages';
import { useOpenSpaceIds } from '../open-space/use-open-space-ids';
import { useSpaceOpenRooms } from '../room/space-open-rooms-context';

export function useEndSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  const { dispatch: dispatchToSpace } = useSpaceOpenRooms();
  const { markClosed } = useOpenSpaceIds();

  return useCallback(
    async (spaceId: string) => {
      dispatchToSpace(spaceId, AnnounceEnded({}));
      await runClientWrite(endSpaceWrite, writeContext, { spaceId }, engine.db);
      markClosed(spaceId);
    },
    [dispatchToSpace, engine, markClosed, writeContext]
  );
}
