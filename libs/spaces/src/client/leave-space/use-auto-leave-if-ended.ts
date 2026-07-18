import { useLeaveSpace } from './use-leave-space';
import { useMyGuestMembershipId } from '../members/use-my-guest-membership-id';
import { useEffect } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';
import {
  SpaceParticipationCol,
  SPACE_PARTICIPATIONS_TABLE,
} from '@libs/db/shared/space-tables';
import { useWatchField } from '@pkgs/sync-engine/client/sync-engine-context';

const PARTICIPATION_BY_ID_SQL = `SELECT ${SpaceParticipationCol.id},
            ${SpaceParticipationCol.deviceId}, ${SpaceParticipationCol.leftAt}
     FROM ${SPACE_PARTICIPATIONS_TABLE.tableName}
     WHERE ${SpaceParticipationCol.id} = ?`;

export function useAutoLeaveIfEnded(spaceId: string): void {
  const leaveSpace = useLeaveSpace();
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  const spaceStillLive = endedAt === null;
  const participationId = useMyGuestMembershipId(spaceId);
  const { value: deviceId } = useWatchField<string>(
    PARTICIPATION_BY_ID_SQL,
    [participationId ?? ''],
    SpaceParticipationCol.deviceId
  );
  const { value: leftAt } = useWatchField<string>(
    PARTICIPATION_BY_ID_SQL,
    [participationId ?? ''],
    SpaceParticipationCol.leftAt
  );
  const participationExists = (deviceId ?? '').length > 0;
  const participationActive = leftAt === null;

  useEffect(() => {
    if (spaceId.length === 0) return;
    if (participationId === null) return;
    if (spaceStillLive) return;
    if (!participationExists) return;
    if (!participationActive) return;
    void leaveSpace(spaceId);
  }, [
    spaceId,
    participationId,
    spaceStillLive,
    participationExists,
    participationActive,
    leaveSpace,
  ]);
}
