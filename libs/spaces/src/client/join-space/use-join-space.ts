import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useCallback } from 'react';

import { joinSpaceAction } from './space-join-action';

export function useJoinSpace() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();

  return useCallback(
    async (spaceId: string) => {
      await joinSpaceAction(engine.db, auth, { spaceId });
    },
    [auth, engine]
  );
}
