import { useWriteContext } from '@libs/auth/client/use-write-context';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
import { useCallback } from 'react';

import { setSpaceVisibilityWrite } from '../../shared/set-visibility/set-visibility-write';

export function useSetVisibility() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();

  return useCallback(
    (spaceId: string, visibility: SpaceVisibility) =>
      runClientWrite(
        setSpaceVisibilityWrite,
        writeContext,
        { spaceId, visibility },
        engine.db
      ),
    [engine, writeContext]
  );
}
