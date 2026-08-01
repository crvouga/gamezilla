import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { FRIENDS_RULES } from '@libs/friends/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  unblockUser,
  unblockUserBeforeBatch,
} from '../../shared/unblock-user/unblock-user-write';

export function useUnblockUser() {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  return useCallback(
    async (userId: string) => {
      const input = { userId };
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: FRIENDS_RULES,
        beforeBatch: unblockUserBeforeBatch(auth, input),
        fn: (tx) => unblockUser(auth, input, tx),
      });
    },
    [auth, engine]
  );
}
