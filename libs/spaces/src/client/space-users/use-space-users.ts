import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { SPACE_RULES } from '@pkgs/rules/spaces/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import { useCallback } from 'react';

import {
  addSpaceUser,
  addSpaceUserBeforeBatch,
  authorizeAddSpaceUser,
} from '../../shared/space-users/add-space-user-write';
import {
  authorizeRemoveSpaceUser,
  removeSpaceUser,
  removeSpaceUserBeforeBatch,
} from '../../shared/space-users/remove-space-user-write';

export function useAddSpaceUser() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();
  return useCallback(
    async (spaceId: string, userId: string) => {
      const input = { spaceId, userId };
      await authorizeAddSpaceUser(auth, input, engine.db);
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: SPACE_RULES,
        beforeBatch: addSpaceUserBeforeBatch(auth, input),
        fn: (tx) => addSpaceUser(auth, input, tx),
      });
    },
    [auth, engine]
  );
}

export function useRemoveSpaceUser() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();
  return useCallback(
    async (spaceId: string, userId: string) => {
      const input = { spaceId, userId };
      await authorizeRemoveSpaceUser(auth, input, engine.db);
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: SPACE_RULES,
        beforeBatch: removeSpaceUserBeforeBatch(input),
        fn: (tx) => removeSpaceUser(auth, input, tx),
      });
    },
    [auth, engine]
  );
}
