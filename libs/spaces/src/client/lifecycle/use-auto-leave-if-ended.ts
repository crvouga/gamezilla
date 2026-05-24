import { useSpaceActions } from './space-actions';
import { useMyGuestMembershipId } from '../members/use-my-guest-membership-id';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { useEffect } from 'react';

/**
 * If a space has ended but the current user still has an active guest
 * membership row, fire a leave-space action to clean up.
 *
 * Reads only attributes (no aggregate types). Skips when:
 * - `spaceId` is empty;
 * - the user has no profile id (`useMyGuestMembershipId` returns null);
 * - the space is still live;
 * - the membership is already left.
 */
export function useAutoLeaveIfEnded(spaceId: string): void {
  const { leaveSpace } = useSpaceActions();

  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.endedAt,
  });
  const spaceStillLive = endedAt === null;

  const membershipId = useMyGuestMembershipId(spaceId);
  const guestId = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId ?? '',
    attribute: SpaceMembershipAttr.guestId,
  });
  const leftAt = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId ?? '',
    attribute: SpaceMembershipAttr.leftAt,
  });
  const membershipExists = guestId.length > 0;
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
