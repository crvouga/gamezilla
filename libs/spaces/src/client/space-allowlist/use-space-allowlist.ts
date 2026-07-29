import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { addSpaceAllowlistWrite } from '../../shared/space-allowlist/add-space-allowlist-write';
import { removeSpaceAllowlistWrite } from '../../shared/space-allowlist/remove-space-allowlist-write';

export function useAddSpaceAllowlist() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  return useCallback(
    async (spaceId: string, userId: string) => {
      await runClientWrite(
        addSpaceAllowlistWrite,
        writeContext,
        { spaceId, userId },
        engine.db
      );
    },
    [engine, writeContext]
  );
}

export function useRemoveSpaceAllowlist() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  return useCallback(
    async (spaceId: string, userId: string) => {
      await runClientWrite(
        removeSpaceAllowlistWrite,
        writeContext,
        { spaceId, userId },
        engine.db
      );
    },
    [engine, writeContext]
  );
}
