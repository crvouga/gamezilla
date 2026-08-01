import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { FRIENDS_RULES } from '@pkgs/rules/friends/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  blockUser,
  blockUserBeforeBatch,
  publishBlockUserEvent,
} from '../../shared/block-user/block-user-write';

export function useBlockUser() {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  return useCallback(
    async (userId: string) => {
      const input = { userId };
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: FRIENDS_RULES,
        beforeBatch: blockUserBeforeBatch(auth, input),
        fn: (tx) => blockUser(auth, input, tx),
      });
      publishBlockUserEvent(auth, userId);
    },
    [auth, engine]
  );
}
