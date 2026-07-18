import { SpaceMemberTileRail } from './space-member-tile-rail';
import type { ReactNode } from 'react';

import {
  useSpaceMembershipColumn,
  SpaceMembershipField,
} from '../use-space-membership-column';

export type SpaceGuestMembershipTileRailProps = {
  spaceId: string;
  membershipId: string;
};

export function SpaceGuestMembershipTileRail({
  spaceId,
  membershipId,
}: SpaceGuestMembershipTileRailProps): ReactNode {
  const memberId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.memberId
  );
  const profileId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.profileId
  );
  if (memberId === null || memberId.length === 0) return null;
  const resolvedProfile =
    profileId !== null && profileId.length > 0 ? profileId : memberId;
  return (
    <SpaceMemberTileRail
      spaceId={spaceId}
      deviceId={memberId}
      profileId={resolvedProfile}
      deviceLabel={null}
    />
  );
}
