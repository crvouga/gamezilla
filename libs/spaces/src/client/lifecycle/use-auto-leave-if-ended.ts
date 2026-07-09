import { useSpaceActions } from './space-actions';
import { useMyGuestMembershipId } from '../members/use-my-guest-membership-id';
import { useEffect } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';
import { useSpaceMembershipColumn, SpaceMembershipField } from '../use-space-membership-column';

export function useAutoLeaveIfEnded(spaceId: string): void {
  const { leaveSpace } = useSpaceActions();
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  const spaceStillLive = endedAt === null;
  const membershipId = useMyGuestMembershipId(spaceId);
  const guestId = useSpaceMembershipColumn(membershipId ?? '', SpaceMembershipField.guestId);
  const leftAt = useSpaceMembershipColumn(membershipId ?? '', SpaceMembershipField.leftAt);
  const membershipExists = (guestId ?? '').length > 0;
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
