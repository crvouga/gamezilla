import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { FRIENDS_RULES } from '@libs/friends/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  authorizeDecline,
  declineFriendRequest,
  declineFriendRequestBeforeBatch,
} from '../../shared/decline-friend-request/decline-friend-request-write';

export function useDeclineFriendRequest() {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  return useCallback(
    async (requestId: string) => {
      const input = { requestId };
      await authorizeDecline(auth, input, engine.db);
      return validatedWrite({
        sql: engine.db,
        auth,
        rules: FRIENDS_RULES,
        beforeBatch: declineFriendRequestBeforeBatch(input),
        fn: (tx) => declineFriendRequest(auth, input, tx),
      });
    },
    [auth, engine]
  );
}
