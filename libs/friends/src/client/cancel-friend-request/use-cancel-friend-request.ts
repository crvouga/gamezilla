import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { FRIENDS_RULES } from '@libs/friends/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  authorizeCancel,
  cancelFriendRequest,
  cancelFriendRequestBeforeBatch,
} from '../../shared/cancel-friend-request/cancel-friend-request-write';

export function useCancelFriendRequest() {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  return useCallback(
    async (requestId: string) => {
      const input = { requestId };
      await authorizeCancel(auth, input, engine.db);
      return validatedWrite({
        sql: engine.db,
        auth,
        rules: FRIENDS_RULES,
        beforeBatch: cancelFriendRequestBeforeBatch(input),
        fn: (tx) => cancelFriendRequest(auth, input, tx),
      });
    },
    [auth, engine]
  );
}
