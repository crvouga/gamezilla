import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { leaveSpaceWrite } from '../../shared/leave-space/leave-space-write';

export function useLeaveSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  return useCallback(
    (spaceId: string) =>
      runClientWrite(leaveSpaceWrite, writeContext, { spaceId }, engine.db),
    [engine, writeContext]
  );
}
