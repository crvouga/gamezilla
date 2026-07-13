import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { removeFriendWrite } from '../../shared/remove-friend/remove-friend-write';

export function useRemoveFriend() {
  const engine = useSyncEngine();
  const writeContext = useWriteContext();
  return useCallback(
    (userId: string) =>
      runClientWrite(
        removeFriendWrite,
        writeContext,
        { userId },
        engine.db
      ),
    [engine, writeContext]
  );
}
