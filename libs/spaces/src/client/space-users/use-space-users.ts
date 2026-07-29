import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { addSpaceUserWrite } from '../../shared/space-users/add-space-user-write';
import { removeSpaceUserWrite } from '../../shared/space-users/remove-space-user-write';

export function useAddSpaceUser() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  return useCallback(
    async (spaceId: string, userId: string) => {
      await runClientWrite(
        addSpaceUserWrite,
        writeContext,
        { spaceId, userId },
        engine.db
      );
    },
    [engine, writeContext]
  );
}

export function useRemoveSpaceUser() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  return useCallback(
    async (spaceId: string, userId: string) => {
      await runClientWrite(
        removeSpaceUserWrite,
        writeContext,
        { spaceId, userId },
        engine.db
      );
    },
    [engine, writeContext]
  );
}
