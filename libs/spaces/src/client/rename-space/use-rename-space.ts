import { useCallback } from 'react';

import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';

import {
  authorizeRenameSpace,
  renameSpace,
  renameSpaceBeforeBatch,
} from '../../shared/rename-space/rename-space-write';
import { AnnounceRenamed } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useRenameSpace() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();
  const dispatch = useSpaceRoomDispatch();

  return useCallback(
    async (spaceId: string, title: string) => {
      dispatch(AnnounceRenamed({ title }));
      const input = { spaceId, title };
      await authorizeRenameSpace(auth, input, engine.db);
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: SPACE_RULES,
        beforeBatch: renameSpaceBeforeBatch(input),
        fn: (tx) => renameSpace(auth, input, tx),
      });
    },
    [auth, dispatch, engine]
  );
}
