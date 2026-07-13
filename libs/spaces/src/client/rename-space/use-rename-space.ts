import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { renameSpaceWrite } from '../../shared/rename-space/rename-space-write';

export function useRenameSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  return useCallback(
    (spaceId: string, title: string) =>
      runClientWrite(
        renameSpaceWrite,
        writeContext,
        { spaceId, title },
        engine.db
      ),
    [engine, writeContext]
  );
}
