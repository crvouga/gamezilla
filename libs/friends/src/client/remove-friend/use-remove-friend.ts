import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { FRIENDS_RULES } from '@libs/friends/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  publishRemoveFriendEvent,
  removeFriend,
  removeFriendBeforeBatch,
} from '../../shared/remove-friend/remove-friend-write';

export function useRemoveFriend() {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  return useCallback(
    async (userId: string) => {
      const input = { userId };
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: FRIENDS_RULES,
        beforeBatch: removeFriendBeforeBatch(auth, input),
        fn: (tx) => removeFriend(auth, input, tx),
      });
      publishRemoveFriendEvent(auth, userId);
    },
    [auth, engine]
  );
}
