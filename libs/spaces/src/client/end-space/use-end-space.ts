import { useCallback } from 'react';

import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';

import {
  authorizeEndSpace,
  endSpaceBeforeBatch,
  executeEndSpace,
} from '../../shared/end-space/end-space-write';
import { AnnounceEnded } from '../../shared/space-log/space-log-messages';
import { useSpaceOpenRooms } from '../room/space-open-rooms-context';

export function useEndSpace() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();
  const { dispatch: dispatchToSpace } = useSpaceOpenRooms();

  return useCallback(
    async (spaceId: string) => {
      dispatchToSpace(spaceId, AnnounceEnded({}));
      const input = { spaceId };
      await authorizeEndSpace(auth, input, engine.db);
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: SPACE_RULES,
        beforeBatch: endSpaceBeforeBatch(input),
        fn: (tx) => executeEndSpace(auth, input, tx),
      });
    },
    [auth, dispatchToSpace, engine]
  );
}
