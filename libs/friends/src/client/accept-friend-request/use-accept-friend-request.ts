import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { acceptFriendRequestWrite } from '../../shared/accept-friend-request/accept-friend-request-write';

export function useAcceptFriendRequest() {
  const engine = useSyncEngine();
  const writeContext = useWriteContext();
  return useCallback(
    (requestId: string) =>
      runClientWrite(
        acceptFriendRequestWrite,
        writeContext,
        { requestId },
        engine.db
      ),
    [engine, writeContext]
  );
}
