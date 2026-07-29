import { SpaceMemberTileRail } from './space-member-tile-rail';
import type { ReactNode } from 'react';

export type SpaceGuestMembershipTileRailProps = {
  spaceId: string;
  /** Guest member / account id (also the profile id). */
  membershipId: string;
};

export function SpaceGuestMembershipTileRail({
  spaceId,
  membershipId,
}: SpaceGuestMembershipTileRailProps): ReactNode {
  if (membershipId.length === 0) return null;
  return (
    <SpaceMemberTileRail
      spaceId={spaceId}
      deviceId={membershipId}
      profileId={membershipId}
      deviceLabel={null}
    />
  );
}
