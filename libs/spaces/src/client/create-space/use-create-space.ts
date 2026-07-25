import { useWriteContext } from '@libs/auth/client/use-write-context';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { createSpaceWrite } from '../../shared/create-space/create-space-write';

export type CreateSpaceOptions = {
  readonly visibility?: SpaceVisibility;
};

export function useCreateSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  return useCallback(
    async (
      onCreated?: (spaceId: string) => void,
      options?: CreateSpaceOptions
    ): Promise<string> => {
      const spaceId = crypto.randomUUID();
      await runClientWrite(
        createSpaceWrite,
        writeContext,
        {
          spaceId,
          visibility: options?.visibility ?? 'private',
        },
        engine.db
      );
      onCreated?.(spaceId);
      return spaceId;
    },
    [engine, writeContext]
  );
}
