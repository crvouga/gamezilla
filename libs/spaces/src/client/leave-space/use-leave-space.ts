import { useCallback } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';
import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { runClientWrite } from '@pkgs/write/client/run-client-write';

import { leaveSpaceWrite } from '../../shared/leave-space/leave-space-write';
import {
  LeaveSpaceSeat,
  SpaceMembersRoomAttr,
} from '../../shared/space-members/space-members-messages';
import { AnnounceMemberLeft } from '../../shared/space-log/space-log-messages';
import { useOpenSpaceIds } from '../open-space/use-open-space-ids';
import { useSpaceOpenRooms } from '../room/space-open-rooms-context';

export function useLeaveSpace() {
  const writeContext = useWriteContext();
  const engine = useSyncEngine();
  const { dispatch: dispatchToSpace, getEntry } = useSpaceOpenRooms();
  const myId = useMyId();
  const { markClosed } = useOpenSpaceIds();

  return useCallback(
    async (spaceId: string) => {
      const entry = getEntry(spaceId);
      const seats =
        entry === null
          ? {}
          : SpaceMembersRoomAttr.seats.from(entry.room.getSnapshot());
      const seatIds = Object.keys(seats);
      // Only auto-end when room seats are known and we are the last seat.
      // Empty seats (room not synced) must not stamp ended_at.
      const endIfLastSeat =
        seatIds.includes(myId) && seatIds.every((id) => id === myId);
      if (myId.length > 0) {
        dispatchToSpace(spaceId, LeaveSpaceSeat({ memberId: myId }));
        dispatchToSpace(spaceId, AnnounceMemberLeft({ memberId: myId }));
      }
      await runClientWrite(
        leaveSpaceWrite,
        writeContext,
        { spaceId, endIfLastSeat },
        engine.db
      );
      markClosed(spaceId);
    },
    [dispatchToSpace, engine, getEntry, markClosed, myId, writeContext]
  );
}
