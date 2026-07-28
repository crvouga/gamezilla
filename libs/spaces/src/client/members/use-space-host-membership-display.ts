import { spaceMembershipEntityId } from '@libs/spaces/shared/membership-key';
import { useMemo } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';
import {
  useSpaceMembershipColumn,
  SpaceMembershipField,
} from '../use-space-membership-column';

export type SpaceHostMembershipDisplay = {
  readonly deviceId: string;
  readonly membershipId: string;
  readonly profileId: string;
  readonly deviceLabel: string | null;
};

/** Host member display fields from the host's user membership row. */
export function useSpaceHostMembershipDisplay(
  spaceId: string
): SpaceHostMembershipDisplay | null {
  const hostMemberId = useSpaceColumn(spaceId, SpaceField.hostMemberId);
  const membershipId =
    hostMemberId !== null && hostMemberId.length > 0
      ? spaceMembershipEntityId(hostMemberId, spaceId)
      : '';
  const profileRaw = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.profileId
  );
  const memberId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.memberId
  );
  return useMemo(() => {
    if (hostMemberId === null || hostMemberId.length === 0) return null;
    const profileId =
      profileRaw !== null && profileRaw.length > 0
        ? profileRaw
        : (memberId ?? hostMemberId);
    return {
      deviceId: hostMemberId,
      membershipId,
      profileId,
      deviceLabel: null,
    };
  }, [hostMemberId, membershipId, profileRaw, memberId]);
}
