import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { declineFriendRequestWrite } from '../../shared/decline-friend-request/decline-friend-request-write';

export function useDeclineFriendRequest() {
  const engine = useSyncEngine();
  const writeContext = useWriteContext();
  return useCallback(
    (requestId: string) =>
      runClientWrite(
        declineFriendRequestWrite,
        writeContext,
        { requestId },
        engine.db
      ),
    [engine, writeContext]
  );
}
