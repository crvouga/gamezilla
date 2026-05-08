import { SpaceMemberTileRail } from '@gamezilla/client/spaces/space-member-tile-rail';
import { parseStringAttr } from '@gamezilla/client/spaces/space-parsers';
import {
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type SpaceGuestMembershipTileRailProps = {
  spaceId: string;
  membershipId: string;
};

/** Rail tile for the guest profile referenced by a membership row. */
export function SpaceGuestMembershipTileRail({
  spaceId,
  membershipId,
}: SpaceGuestMembershipTileRailProps): ReactNode {
  const guestId = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId,
    attributeKey: SpaceMembershipAttr.guestId,
    attributeValue: parseStringAttr,
  });
  if (guestId === null) return null;
  return <SpaceMemberTileRail spaceId={spaceId} profileId={guestId} />;
}
