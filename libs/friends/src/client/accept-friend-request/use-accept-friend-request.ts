import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { FRIENDS_RULES } from '@libs/friends/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  acceptFriendRequest,
  acceptFriendRequestBeforeBatch,
  authorizeAccept,
  publishAcceptFriendRequestEvent,
} from '../../shared/accept-friend-request/accept-friend-request-write';

export function useAcceptFriendRequest() {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  return useCallback(
    async (requestId: string) => {
      const input = { requestId };
      await authorizeAccept(auth, input, engine.db);
      const result = await validatedWrite({
        sql: engine.db,
        auth,
        rules: FRIENDS_RULES,
        beforeBatch: acceptFriendRequestBeforeBatch(input),
        fn: (tx) => acceptFriendRequest(auth, input, tx),
      });
      if (result.accepted) {
        publishAcceptFriendRequestEvent(auth, result.request);
      }
      return result.request;
    },
    [auth, engine]
  );
}
