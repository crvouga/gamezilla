import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { leaveSpaceEverywhereWrite } from '../../shared/leave-space/leave-space-everywhere-write';

export function useLeaveSpaceEverywhere() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  return useCallback(
    (spaceId: string) =>
      runClientWrite(
        leaveSpaceEverywhereWrite,
        writeContext,
        { spaceId },
        engine.db
      ),
    [engine, writeContext]
  );
}
