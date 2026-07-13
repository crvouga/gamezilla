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
  const deviceId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.guestId
  );
  const profileId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.profileId
  );
  const deviceLabel = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.deviceLabel
  );
  if (deviceId === null || deviceId.length === 0) return null;
  const resolvedProfile =
    profileId !== null && profileId.length > 0 ? profileId : deviceId;
  return (
    <SpaceMemberTileRail
      spaceId={spaceId}
      deviceId={deviceId}
      profileId={resolvedProfile}
      deviceLabel={deviceLabel}
    />
  );
}
