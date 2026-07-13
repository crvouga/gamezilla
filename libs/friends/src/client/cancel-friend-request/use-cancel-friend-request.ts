import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { cancelFriendRequestWrite } from '../../shared/cancel-friend-request/cancel-friend-request-write';

export function useCancelFriendRequest() {
  const engine = useSyncEngine();
  const writeContext = useWriteContext();
  return useCallback(
    (requestId: string) =>
      runClientWrite(
        cancelFriendRequestWrite,
        writeContext,
        { requestId },
        engine.db
      ),
    [engine, writeContext]
  );
}
