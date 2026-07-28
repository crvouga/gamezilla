import { useCallback } from 'react';

import { useWriteContext } from '@libs/auth/client/use-write-context';
import type { SpaceVisibility } from '@libs/spaces/shared/space-visibility';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';

import { setSpaceVisibilityWrite } from '../../shared/set-visibility/set-visibility-write';
import { AnnounceVisibilityChanged } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useSetVisibility() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  const dispatch = useSpaceRoomDispatch();

  return useCallback(
    async (spaceId: string, visibility: SpaceVisibility) => {
      dispatch(AnnounceVisibilityChanged({ visibility }));
      await runClientWrite(
        setSpaceVisibilityWrite,
        writeContext,
        { spaceId, visibility },
        engine.db
      );
    },
    [dispatch, engine, writeContext]
  );
}
