import { parseStringAttr } from '@gamezilla/client/spaces/space-parsers';
import { SpaceMemberTileChip } from '@gamezilla/client/spaces/space-member-tile-chip';
import {
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type SpaceGuestMembershipTileChipProps = {
  spaceId: string;
  membershipId: string;
};

/** Chip tile for the guest profile referenced by a membership row. */
export function SpaceGuestMembershipTileChip({
  spaceId,
  membershipId,
}: SpaceGuestMembershipTileChipProps): ReactNode {
  const guestId = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId,
    attributeKey: SpaceMembershipAttr.guestId,
    attributeValue: parseStringAttr,
  });
  if (guestId === null) return null;
  return <SpaceMemberTileChip spaceId={spaceId} profileId={guestId} />;
}
