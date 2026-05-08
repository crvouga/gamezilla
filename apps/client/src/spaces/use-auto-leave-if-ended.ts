import { useSpaceActions } from '@gamezilla/client/spaces/space-actions';
import { parseAbsent, parseExists } from '@gamezilla/client/spaces/space-parsers';
import { useMyGuestMembershipId } from '@gamezilla/client/spaces/use-my-guest-membership-id';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
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

  const isLive = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.endedAt,
    attributeValue: parseAbsent,
  });

  const membershipId = useMyGuestMembershipId(spaceId);
  const membershipExists = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId ?? '',
    attributeKey: SpaceMembershipAttr.guestId,
    attributeValue: parseExists,
  });
  const membershipActive = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId ?? '',
    attributeKey: SpaceMembershipAttr.leftAt,
    attributeValue: parseAbsent,
  });

  useEffect(() => {
    if (spaceId.length === 0) return;
    if (membershipId === null) return;
    if (isLive) return;
    if (!membershipExists) return;
    if (!membershipActive) return;
    void leaveSpace(spaceId);
  }, [
    spaceId,
    membershipId,
    isLive,
    membershipExists,
    membershipActive,
    leaveSpace,
  ]);
}
