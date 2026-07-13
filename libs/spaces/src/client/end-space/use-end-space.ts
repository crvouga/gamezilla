import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { endSpaceWrite } from '../../shared/end-space/end-space-write';

export function useEndSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  return useCallback(
    (spaceId: string) =>
      runClientWrite(endSpaceWrite, writeContext, { spaceId }, engine.db),
    [engine, writeContext]
  );
}
