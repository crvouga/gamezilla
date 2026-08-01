import { useCallback } from 'react';

import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';

import {
  authorizeSetSpaceVisibility,
  setSpaceVisibility,
  setVisibilityBeforeBatch,
} from '../../shared/set-visibility/set-visibility-write';
import { AnnounceVisibilityChanged } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useSetVisibility() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();
  const dispatch = useSpaceRoomDispatch();

  return useCallback(
    async (spaceId: string, visibility: SpaceVisibility) => {
      dispatch(AnnounceVisibilityChanged({ visibility }));
      const input = { spaceId, visibility };
      await authorizeSetSpaceVisibility(auth, input, engine.db);
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: SPACE_RULES,
        beforeBatch: setVisibilityBeforeBatch(input),
        fn: (tx) => setSpaceVisibility(auth, input, tx),
      });
    },
    [auth, dispatch, engine]
  );
}
