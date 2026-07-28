import { useCallback } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';
import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';

import { leaveSpaceWrite } from '../../shared/leave-space/leave-space-write';
import { AnnounceMemberLeft } from '../../shared/space-log/space-log-messages';
import { useSpaceRoomDispatch } from '../room/use-space-room-selector';

export function useLeaveSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  const dispatch = useSpaceRoomDispatch();
  const myId = useMyId();

  return useCallback(
    async (spaceId: string) => {
      // Best-effort log line before the write tears the room down.
      if (myId.length > 0) {
        dispatch(AnnounceMemberLeft({ memberId: myId }));
      }
      await runClientWrite(
        leaveSpaceWrite,
        writeContext,
        { spaceId },
        engine.db
      );
    },
    [dispatch, engine, myId, writeContext]
  );
}
