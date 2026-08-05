import { useCallback } from 'react';

import { useMyId } from '@libs/auth/client/use-current-user';
import { useRulesAuth } from '@libs/auth/client/use-rules-auth';
import { SPACE_RULES } from '@libs/spaces/shared/rules/rules';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';

import {
  actorIsSpaceHost,
  authorizeLeaveSpace,
  executeLeaveSpace,
  leaveSpaceBeforeBatch,
} from '../../shared/leave-space/leave-space-write';
import {
  LeaveSpaceSeat,
  SpaceMembersRoomAttr,
} from '../../shared/space-members/space-members-messages';
import { AnnounceMemberLeft } from '../../shared/space-log/space-log-messages';
import { useSpaceOpenRooms } from '../room/space-open-rooms-context';

export function useLeaveSpace() {
  const auth = useRulesAuth();
  const engine = useSyncEngine();
  const { dispatch: dispatchToSpace, getEntry } = useSpaceOpenRooms();
  const myId = useMyId();

  return useCallback(
    async (spaceId: string) => {
      const entry = getEntry(spaceId);
      const seats =
        entry === null
          ? {}
          : SpaceMembersRoomAttr.seats.from(entry.room.getSnapshot());
      const seatIds = Object.keys(seats);
      const endIfLastSeat =
        seatIds.includes(myId) && seatIds.every((id) => id === myId);
      if (myId.length > 0) {
        dispatchToSpace(spaceId, LeaveSpaceSeat({ memberId: myId }));
        dispatchToSpace(spaceId, AnnounceMemberLeft({ memberId: myId }));
      }
      const input = { spaceId, endIfLastSeat };
      await authorizeLeaveSpace(auth, input, engine.db);
      const willWrite =
        endIfLastSeat === true ||
        (await actorIsSpaceHost(auth, engine.db, spaceId));
      const beforeBatch = leaveSpaceBeforeBatch(auth, input, willWrite);
      await validatedWrite({
        sql: engine.db,
        auth,
        rules: SPACE_RULES,
        ...(beforeBatch !== undefined ? { beforeBatch } : {}),
        fn: (tx) => executeLeaveSpace(auth, input, tx),
      });
    },
    [auth, dispatchToSpace, engine, getEntry, myId]
  );
}
