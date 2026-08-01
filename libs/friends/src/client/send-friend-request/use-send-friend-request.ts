import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { FRIENDS_RULES } from '@libs/friends/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  publishSendFriendRequestEvent,
  sendFriendRequest,
  sendFriendRequestBeforeBatch,
} from '../../shared/send-friend-request/send-friend-request-write';

export function useSendFriendRequest() {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  return useCallback(
    async (toUserId: string) => {
      const input = { toUserId };
      const provisionalId = crypto.randomUUID();
      const result = await validatedWrite({
        sql: engine.db,
        auth,
        rules: FRIENDS_RULES,
        beforeBatch: sendFriendRequestBeforeBatch(auth, input, provisionalId),
        fn: (tx) => sendFriendRequest(auth, input, tx),
      });
      if (result.created) {
        publishSendFriendRequestEvent(result.request);
      }
      return result.request;
    },
    [auth, engine]
  );
}
