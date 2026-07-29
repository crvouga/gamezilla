import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useCallback } from 'react';

import { useOpenSpaceIds } from '../open-space/use-open-space-ids';
import { joinSpaceAction } from './space-join-action';

export function useJoinSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  const { markOpen } = useOpenSpaceIds();

  return useCallback(
    async (spaceId: string) => {
      await joinSpaceAction(engine.db, writeContext, { spaceId }, markOpen);
    },
    [engine, markOpen, writeContext]
  );
}
