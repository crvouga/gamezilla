import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { blockUserWrite } from '../../shared/block-user/block-user-write';

export function useBlockUser() {
  const engine = useSyncEngine();
  const writeContext = useWriteContext();
  return useCallback(
    (userId: string) =>
      runClientWrite(blockUserWrite, writeContext, { userId }, engine.db),
    [engine, writeContext]
  );
}
