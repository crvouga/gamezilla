import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { sendFriendRequestWrite } from '../../shared/send-friend-request/send-friend-request-write';

export function useSendFriendRequest() {
  const engine = useSyncEngine();
  const writeContext = useWriteContext();
  return useCallback(
    (toUserId: string) =>
      runClientWrite(
        sendFriendRequestWrite,
        writeContext,
        { toUserId },
        engine.db
      ),
    [engine, writeContext]
  );
}
