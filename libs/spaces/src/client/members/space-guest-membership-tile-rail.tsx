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
  const guestId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.guestId
  );
  if (guestId === null) return null;
  return <SpaceMemberTileRail spaceId={spaceId} profileId={guestId} />;
}
