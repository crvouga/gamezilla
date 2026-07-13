import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { unblockUserWrite } from '../../shared/unblock-user/unblock-user-write';

export function useUnblockUser() {
  const engine = useSyncEngine();
  const writeContext = useWriteContext();
  return useCallback(
    (userId: string) =>
      runClientWrite(unblockUserWrite, writeContext, { userId }, engine.db),
    [engine, writeContext]
  );
}
