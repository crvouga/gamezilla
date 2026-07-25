import { useLeaveSpace } from './use-leave-space';
import { useMyMembershipId } from '../members/use-my-guest-membership-id';
import { useEffect } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';
import {
  SpaceMembershipCol,
  SPACE_MEMBERSHIPS_TABLE,
} from '@libs/db/shared/space-tables';
import { useWatchField } from '@pkgs/sync-engine/client/sync-engine-context';

const MEMBERSHIP_BY_ID_SQL = `SELECT ${SpaceMembershipCol.id},
            ${SpaceMembershipCol.memberId}, ${SpaceMembershipCol.leftAt}
     FROM ${SPACE_MEMBERSHIPS_TABLE.tableName}
     WHERE ${SpaceMembershipCol.id} = ?`;

export function useAutoLeaveIfEnded(spaceId: string): void {
  const leaveSpace = useLeaveSpace();
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  const spaceStillLive = endedAt === null;
  const membershipId = useMyMembershipId(spaceId);
  const { value: memberId } = useWatchField<string>(
    MEMBERSHIP_BY_ID_SQL,
    [membershipId ?? ''],
    SpaceMembershipCol.memberId
  );
  const { value: leftAt } = useWatchField<string>(
    MEMBERSHIP_BY_ID_SQL,
    [membershipId ?? ''],
    SpaceMembershipCol.leftAt
  );
  const membershipExists = (memberId ?? '').length > 0;
  const membershipActive = leftAt === null;

  useEffect(() => {
    if (spaceId.length === 0) return;
    if (membershipId === null) return;
    if (spaceStillLive) return;
    if (!membershipExists) return;
    if (!membershipActive) return;
    void leaveSpace(spaceId);
  }, [
    spaceId,
    membershipId,
    spaceStillLive,
    membershipExists,
    membershipActive,
    leaveSpace,
  ]);
}
